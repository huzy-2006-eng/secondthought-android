package app.secondthought.guardian;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;

/** Turns notification taps and "Share to SecondThought" into an in-app route for the web UI. */
final class LaunchQueue {
    private static JSObject pending;
    private static SecondThoughtPlugin listener;

    private LaunchQueue() {}

    static synchronized void offer(Context ctx, Intent intent) {
        JSObject launch = parse(ctx, intent);
        if (launch != null && launch.getString("route", "").startsWith("/incoming")) CallNotifier.cancelIncoming(ctx);
        if (launch == null) return;
        if (listener != null) listener.emitLaunch(launch);
        else pending = launch;
    }

    static synchronized JSObject take() {
        JSObject p = pending;
        pending = null;
        return p;
    }

    static synchronized void attach(SecondThoughtPlugin p) { listener = p; }

    private static JSObject parse(Context ctx, Intent intent) {
        if (intent == null) return null;
        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action) && intent.getType() != null && intent.getType().startsWith("image/")) {
            Uri img = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (img == null) return null;
            JSObject o = new JSObject();
            o.put("route", "/check");
            o.put("image", img.toString());   // read on the phone by readSharedImage()
            return o;
        }
        if (Intent.ACTION_SEND.equals(action) && "text/plain".equals(intent.getType())) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (text == null) return null;
            JSObject o = new JSObject();
            o.put("route", "/check");
            o.put("text", (subject != null && !text.contains(subject) ? subject + "\n" : "") + text);
            return o;
        }
        Uri data = intent.getData();
        if (Intent.ACTION_VIEW.equals(action) && data != null && "secondthought".equals(data.getScheme())) {
            String route = data.getEncodedPath() == null ? "/" : data.getEncodedPath();
            JSObject o = new JSObject();
            if ("/check".equals(route) && data.getQueryParameter("alert") != null) {
                // From our own live SMS warning: open Check with that SMS and its sender. Only ids the app created
                // itself are accepted, so another app can't show a scam message with a fake "verified" sender.
                o.put("route", "/check");
                org.json.JSONObject sms = SmsReceiver.takeAlert(ctx, data.getQueryParameter("alert"));
                if (sms != null) {
                    o.put("text", sms.optString("text", ""));
                    o.put("sender", sms.optString("sender", ""));
                }
                return o;
            }
            if ("/check".equals(route)) { o.put("route", "/check"); return o; }  // never take text or sender from a link
            if (data.getEncodedQuery() != null) route += "?" + data.getEncodedQuery();
            o.put("route", route);
            return o;
        }
        return null;
    }
}
