package app.secondthought.guardian;

import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Bridge between the SecondThought UI and Android: call screening, notifications, sharing, texting/calling family. */
@CapacitorPlugin(
    name = "SecondThought",
    permissions = {
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
    }
)
public class SecondThoughtPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        CallNotifier.ensureChannels(getContext());
        LaunchQueue.attach(this);
    }

    @Override
    protected void handleOnDestroy() {
        LaunchQueue.attach(null);
    }

    void emitLaunch(JSObject launch) {
        notifyListeners("launch", launch, true);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("secondthought", Context.MODE_PRIVATE);
    }

    private boolean screeningHeld() {
        if (Build.VERSION.SDK_INT < 29) return false;
        RoleManager rm = getContext().getSystemService(RoleManager.class);
        return rm != null && rm.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) && rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING);
    }

    private boolean notificationsOn() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    // ------------------------------------------------------------------ status and setup
    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("screeningSupported", Build.VERSION.SDK_INT >= 29);
        r.put("screeningEnabled", screeningHeld());
        r.put("unknownCallPrompt", prefs().getBoolean("unknown_call_prompt", true));
        r.put("notifications", notificationsOn());
        call.resolve(r);
    }

    @PluginMethod
    public void requestCallScreening(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.reject("Unknown-caller protection needs Android 10 or newer.");
            return;
        }
        if (screeningHeld()) {
            JSObject r = new JSObject();
            r.put("enabled", true);
            call.resolve(r);
            return;
        }
        RoleManager rm = getContext().getSystemService(RoleManager.class);
        if (rm == null || !rm.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
            call.reject("This phone does not let apps screen calls.");
            return;
        }
        startActivityForResult(call, rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), "onRoleResult");
    }

    @ActivityCallback
    private void onRoleResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        r.put("enabled", screeningHeld());
        call.resolve(r);
    }

    @PluginMethod
    public void setUnknownCallPrompt(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        prefs().edit().putBoolean("unknown_call_prompt", on).apply();
        JSObject r = new JSObject();
        r.put("unknownCallPrompt", on);
        call.resolve(r);
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("granted", notificationsOn());
            call.resolve(r);
            return;
        }
        requestPermissionForAlias("notifications", call, "onNotificationPermission");
    }

    @PermissionCallback
    private void onNotificationPermission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", notificationsOn());
        call.resolve(r);
    }

    // ------------------------------------------------------------------ notifications
    @PluginMethod
    public void notify(PluginCall call) {
        String title = call.getString("title", "SecondThought");
        String body = call.getString("body", "");
        String route = call.getString("route", "/");
        int id = call.getInt("id", (int) (System.currentTimeMillis() & 0xffff));
        CallNotifier.showAlert(getContext(), 5000 + (id & 0xfff), title, body, route);
        call.resolve();
    }

    @PluginMethod
    public void simulateIncomingCall(PluginCall call) {
        final String number = call.getString("number", "+91 00000 00102");
        int delay = call.getInt("delayMs", 3000);
        final Context ctx = getContext().getApplicationContext();
        main.postDelayed(() -> {
            CallNotifier.showIncoming(ctx, number, true, null, 0);
            CallerCheck.run(ctx, number, (verdict, reports) -> CallNotifier.showIncoming(ctx, number, true, verdict, reports));
        }, Math.max(0, delay));
        call.resolve();
    }

    @PluginMethod
    public void consumeLaunch(PluginCall call) {
        JSObject p = LaunchQueue.take();
        call.resolve(p == null ? new JSObject() : p);
    }

    @PluginMethod
    public void share(PluginCall call) {
        String text = call.getString("text", "");
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        send.putExtra(Intent.EXTRA_SUBJECT, call.getString("title", "Scam report"));
        Intent chooser = Intent.createChooser(send, call.getString("title", "Share"));
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(chooser);
        call.resolve();
    }

    // ------------------------------------------------------------------ screenshot scan (on-device OCR)
    /** Lets the person pick a screenshot, then reads its text on the phone. */
    @PluginMethod
    public void scanImage(PluginCall call) {
        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.setType("image/*");
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        try {
            startActivityForResult(call, Intent.createChooser(pick, "Choose a screenshot"), "onImagePicked");
        } catch (Exception e) {
            call.reject("No gallery or files app found.");
        }
    }

    @ActivityCallback
    private void onImagePicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject r = new JSObject();
            r.put("cancelled", true);
            call.resolve(r);
            return;
        }
        readUri(call, result.getData().getData());
    }

    /** Reads a screenshot that was shared to SecondThought (uri from the launch event). */
    @PluginMethod
    public void readSharedImage(PluginCall call) {
        String uri = call.getString("uri", "");
        if (uri.isEmpty()) { call.reject("No image."); return; }
        readUri(call, android.net.Uri.parse(uri));
    }

    private void readUri(PluginCall call, android.net.Uri uri) {
        ScreenshotReader.read(getContext(), uri, new ScreenshotReader.Done() {
            @Override public void onText(String text, String script) {
                JSObject r = new JSObject();
                r.put("text", text);
                r.put("script", script);
                call.resolve(r);
            }
            @Override public void onError(String message) { call.reject(message); }
        });
    }

    /** Opens a website (e.g. Sanchar Saathi / Chakshu, cybercrime.gov.in) in the phone's browser. */
    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.startsWith("https://")) { call.reject("Only https links can be opened."); return; }
        Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); call.resolve(); } catch (Exception e) { call.reject("No browser found."); }
    }

    /** Opens the messages app with the help text ready; the person taps Send (no SMS permission needed). */
    @PluginMethod
    public void sms(PluginCall call) {
        String to = call.getString("to", "");
        Intent i = new Intent(Intent.ACTION_SENDTO, android.net.Uri.parse("smsto:" + android.net.Uri.encode(to)));
        i.putExtra("sms_body", call.getString("body", ""));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("No messages app found.");
        }
    }

    /** Opens the dialler with the number filled in (no CALL_PHONE permission needed). */
    @PluginMethod
    public void dial(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:" + android.net.Uri.encode(call.getString("to", ""))));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("No phone app found.");
        }
    }
}
