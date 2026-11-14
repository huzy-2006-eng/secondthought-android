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
        String route = "/check?text=" + Uri.encode(text) + "&sender=" + Uri.encode(from == null ? "" : from);
        String preview = (r.sender == null ? "" : r.sender + ": ") + (body.length() > 90 ? body.substring(0, 90) + "…" : body);
        CallNotifier.showAlert(ctx, 5200 + (Math.abs(body.hashCode()) % 500), "⚠ " + title(ctx, r),
            preview + "\n" + ctx.getString(R.string.sms_tap), route);
    }
}
