package app.secondthought.guardian;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * The "Unknown number calling. Protect this call?" prompt.
 * Nothing is listened to until the person taps "Protect this call" and agrees again inside the app.
 */
public final class CallNotifier {
    public static final String CH_CALLS = "unknown_calls";
    public static final String CH_ALERTS = "family_alerts";
    static final int ID_INCOMING = 4101;

    private CallNotifier() {}

    public static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        NotificationChannel calls = new NotificationChannel(CH_CALLS, ctx.getString(R.string.channel_calls), NotificationManager.IMPORTANCE_HIGH);
        calls.setDescription(ctx.getString(R.string.channel_calls_desc));
        NotificationChannel alerts = new NotificationChannel(CH_ALERTS, ctx.getString(R.string.channel_alerts), NotificationManager.IMPORTANCE_HIGH);
        alerts.setDescription(ctx.getString(R.string.channel_alerts_desc));
        alerts.enableVibration(true);
        alerts.setVibrationPattern(new long[] {0, 400, 150, 400, 150, 400});
        nm.createNotificationChannel(calls);
        nm.createNotificationChannel(alerts);
    }

    /** Masks all but the last four digits; the full number never appears on the lock screen. */
    public static String mask(String number) {
        if (number == null) return "";
        String digits = number.replaceAll("[^0-9]", "");
        if (digits.length() <= 4) return digits;
        return "••••" + digits.substring(digits.length() - 4);
    }

    static PendingIntent openRoute(Context ctx, String route, int requestCode) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse("secondthought://open" + route));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** verdict: null while checking, else "reported" | "seen" | "unknown" | "offline". */
    public static void showIncoming(Context ctx, String number, boolean simulated, String verdict, int reports) {
        ensureChannels(ctx);
        String masked = mask(number);
        String route = "/incoming?n=" + Uri.encode(number == null ? "" : number) + (simulated ? "&sim=1" : "");
        String title = ctx.getString(R.string.incoming_title) + (masked.isEmpty() ? "" : " (" + masked + ")");
        String text;
        if (verdict == null) text = ctx.getString(R.string.incoming_checking);
        else if ("reported".equals(verdict) || "seen".equals(verdict)) text = ctx.getString(R.string.incoming_reported, reports);
        else if ("offline".equals(verdict)) text = ctx.getString(R.string.incoming_offline);
        else text = ctx.getString(R.string.incoming_not_reported);
        if (simulated) title = ctx.getString(R.string.incoming_test_prefix) + " " + title;

        Intent dismiss = new Intent(ctx, DismissReceiver.class);
        PendingIntent dismissPi = PendingIntent.getBroadcast(ctx, 2, dismiss, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CH_CALLS)
            .setSmallIcon(R.drawable.ic_stat_shield)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text + "\n" + ctx.getString(R.string.incoming_ask)))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(verdict != null)
            .setAutoCancel(true)
            .setTimeoutAfter(120_000)
            .setContentIntent(openRoute(ctx, route, 1))
            .addAction(0, ctx.getString(R.string.incoming_protect), openRoute(ctx, route + "&protect=1", 3))
            .addAction(0, ctx.getString(R.string.incoming_not_now), dismissPi);
        if ("reported".equals(verdict) || "seen".equals(verdict)) b.setColor(0xFFD03B3B).setColorized(false);
        try {
            NotificationManagerCompat.from(ctx).notify(ID_INCOMING, b.build());
        } catch (SecurityException ignored) {
            // notification permission not granted: the in-app setup screen explains how to turn it on
        }
    }

    public static void cancelIncoming(Context ctx) {
        NotificationManagerCompat.from(ctx).cancel(ID_INCOMING);
    }

    public static void showAlert(Context ctx, int id, String title, String body, String route) {
        ensureChannels(ctx);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CH_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_shield)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(openRoute(ctx, route == null ? "/" : route, 10 + (id & 0xff)));
        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
        } catch (SecurityException ignored) { }
    }
}
