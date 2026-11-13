package app.secondthought.guardian;

import android.Manifest;
import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
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
import java.util.ArrayList;

/** Bridge between the SecondThought UI and Android: call screening, speech, notifications, sharing. */
@CapacitorPlugin(
    name = "SecondThought",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
    }
)
public class SecondThoughtPlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private boolean wantListening = false;
    private boolean onDevice = false;
    private String speechLang = "en-IN";
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        CallNotifier.ensureChannels(getContext());
        LaunchQueue.attach(this);
    }

    @Override
    protected void handleOnDestroy() {
        LaunchQueue.attach(null);
        destroyRecognizer();
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
        r.put("microphone", getPermissionState("microphone") == PermissionState.GRANTED);
        r.put("speechAvailable", SpeechRecognizer.isRecognitionAvailable(getContext()));
        r.put("onDeviceSpeech", Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()));
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

    // ------------------------------------------------------------------ speech (second phone / speaker)
    @PluginMethod
    public void startListening(PluginCall call) {
        speechLang = call.getString("lang", "en-IN");
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "onMicPermission");
            return;
        }
        beginListening(call);
    }

    @PermissionCallback
    private void onMicPermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) beginListening(call);
        else call.reject("Microphone permission was denied.");
    }

    /** True while this phone is in a phone/VoIP call: Android then gives apps silence instead of the call audio. */
    private boolean inCall() {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return false;
        int m = am.getMode();
        return m == AudioManager.MODE_IN_CALL || m == AudioManager.MODE_IN_COMMUNICATION;
    }

    private static final String IN_CALL_MSG =
        "This phone is in a call, and Android doesn't let any app hear calls. Open SecondThought on a second phone next to the speaker, or tap \"Type what they're saying\".";

    private void beginListening(PluginCall call) {
        if (inCall()) {
            call.reject(IN_CALL_MSG, "IN_CALL");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition is not available on this phone.");
            return;
        }
        main.post(() -> {
            wantListening = true;
            onDevice = Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
            createAndStart();
            JSObject r = new JSObject();
            r.put("listening", true);
            r.put("onDevice", onDevice);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        main.post(() -> {
            wantListening = false;
            destroyRecognizer();
            emitState(false, null);
            call.resolve();
        });
    }

    private void createAndStart() {
        destroyRecognizer();
        if (onDevice && Build.VERSION.SDK_INT >= 31) recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
        else recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        recognizer.setRecognitionListener(new Listener());
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, speechLang);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
        recognizer.startListening(i);
        emitState(true, null);
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            try { recognizer.cancel(); recognizer.destroy(); } catch (Exception ignored) { }
            recognizer = null;
        }
    }

    private void restartSoon() {
        if (wantListening) main.postDelayed(() -> { if (wantListening) createAndStart(); }, 250);
    }

    private void emitState(boolean listening, String error) {
        JSObject s = new JSObject();
        s.put("listening", listening);
        s.put("onDevice", onDevice);
        if (error != null) s.put("error", error);
        notifyListeners("speechState", s);
    }

    private void emitText(Bundle results, boolean isFinal) {
        ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (list == null || list.isEmpty() || list.get(0).trim().isEmpty()) return;
        JSObject o = new JSObject();
        o.put("text", list.get(0));
        o.put("final", isFinal);
        notifyListeners("speech", o);
    }

    private class Listener implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle params) { }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float rmsdB) { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int eventType, Bundle params) { }
        @Override public void onPartialResults(Bundle partial) { emitText(partial, false); }
        @Override public void onResults(Bundle results) { emitText(results, true); restartSoon(); }

        @Override
        public void onError(int error) {
            if (!wantListening) return;
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                    || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT) {
                restartSoon();  // silence or a hiccup: keep listening
                return;
            }
            if (inCall()) {
                wantListening = false;
                emitState(false, IN_CALL_MSG);
                return;
            }
            // 11 server disconnected, 12 language not supported, 13 language unavailable
            if (onDevice && (error == 11 || error == 12 || error == 13)) {
                onDevice = false;  // no offline pack for this language: fall back to the phone's normal speech service
                restartSoon();
                return;
            }
            wantListening = false;
            String msg = error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "Microphone permission was denied."
                : error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ? "No internet for speech recognition."
                : error == SpeechRecognizer.ERROR_AUDIO ? "The microphone is busy (another app or a call is using it)."
                : "Speech recognition stopped (error " + error + "). Tap Start listening to try again.";
            emitState(false, msg);
        }
    }
}
