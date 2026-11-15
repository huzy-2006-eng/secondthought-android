package app.secondthought.guardian;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import androidx.core.content.ContextCompat;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Live sender check: when an SMS arrives, compare its sender ID with what it claims to be
 * (bank, government office, phone company...). Only a mismatch raises a notification.
 * Runs on the phone; the SMS is not uploaded or stored.
 */
public class SmsReceiver extends BroadcastReceiver {
    static final String PREF = "sms_watch";
    static final String ALERTS = "sms_alerts";

    /** The SMS behind one of our own warnings (one-time; expires after a day). Null for unknown ids. */
    static org.json.JSONObject takeAlert(Context ctx, String id) {
        if (id == null) return null;
        android.content.SharedPreferences sp = ctx.getSharedPreferences(ALERTS, Context.MODE_PRIVATE);
        String raw = sp.getString(id, null);
        android.content.SharedPreferences.Editor ed = sp.edit().remove(id);
        long now = System.currentTimeMillis();
        for (java.util.Map.Entry<String, ?> e : sp.getAll().entrySet()) {   // tidy up old ones
            try { if (now - new org.json.JSONObject(String.valueOf(e.getValue())).optLong("at", 0) > 86_400_000L) ed.remove(e.getKey()); }
            catch (org.json.JSONException ex) { ed.remove(e.getKey()); }
        }
        ed.apply();
        if (raw == null) return null;
        try {
            org.json.JSONObject o = new org.json.JSONObject(raw);
            return now - o.optLong("at", 0) > 86_400_000L ? null : o;
        } catch (org.json.JSONException e) { return null; }
    }
    private static SenderCheck checker;

    static boolean watching(Context ctx) {
        return ctx.getSharedPreferences("secondthought", Context.MODE_PRIVATE).getBoolean(PREF, false)
            && ContextCompat.checkSelfPermission(ctx, "android.permission.RECEIVE_SMS") == PackageManager.PERMISSION_GRANTED;
    }

    static synchronized SenderCheck checker(Context ctx) throws Exception {
        if (checker == null) {
            try (InputStream in = ctx.getAssets().open("public/engine/senders.json")) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                checker = new SenderCheck(out.toString(StandardCharsets.UTF_8.name()));
            }
        }
        return checker;
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction()) || !watching(ctx)) return;
        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;
        String from = parts[0].getDisplayOriginatingAddress();
        StringBuilder body = new StringBuilder();
        for (SmsMessage p : parts) if (p.getDisplayMessageBody() != null) body.append(p.getDisplayMessageBody());
        try {
            SenderCheck.Result r = checker(ctx).check(from, body.toString());
            if (r != null && r.alert()) notifyMismatch(ctx, r, from, body.toString());
        } catch (Exception ignored) {
            // never break SMS delivery because of the check
        }
    }

    static String title(Context ctx, SenderCheck.Result r) {
        String who = r.entity == null ? "" : r.entity;
        switch (r.code) {
            case "mobile_claim": return ctx.getString(R.string.sms_mobile_claim, who);
            case "intl_claim": return ctx.getString(R.string.sms_intl_claim, who);
            case "lookalike": return ctx.getString(R.string.sms_lookalike, r.header, who);
            case "mismatch": return ctx.getString(R.string.sms_mismatch, who, r.header);
            case "unrelated_header": return ctx.getString(R.string.sms_unrelated, who, r.header);
            case "promo_category": case "promo_urgent": return ctx.getString(R.string.sms_promo);
            default: return ctx.getString(R.string.sms_foreign);
        }
    }

    static void notifyMismatchPublic(Context ctx, SenderCheck.Result r, String from, String body) { notifyMismatch(ctx, r, from, body); }

    private static void notifyMismatch(Context ctx, SenderCheck.Result r, String from, String body) {
        String text = body.length() > 1200 ? body.substring(0, 1200) : body;
        // Tapping opens Check with the message and its sender filled in; the full check (words + links + sender) runs there.
        // The message is kept on the phone under a random one-time id: other apps can't open Check with a made-up
        // "verified" sender, because only ids created here are accepted (LaunchQueue.takeSmsAlert).
        String id = java.util.UUID.randomUUID().toString();
        try {
            org.json.JSONObject o = new org.json.JSONObject();
            o.put("text", text);
            o.put("sender", from == null ? "" : from);
            o.put("at", System.currentTimeMillis());
            ctx.getSharedPreferences(ALERTS, Context.MODE_PRIVATE).edit().putString(id, o.toString()).apply();
        } catch (org.json.JSONException ignored) { return; }
        String route = "/check?alert=" + id;
        String preview = (r.sender == null ? "" : r.sender + ": ") + (body.length() > 90 ? body.substring(0, 90) + "…" : body);
        CallNotifier.showAlert(ctx, 5200 + (Math.abs(body.hashCode()) % 500), "⚠ " + title(ctx, r),
            preview + "\n" + ctx.getString(R.string.sms_tap), route);
    }
}
