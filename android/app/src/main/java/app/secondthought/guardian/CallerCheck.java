package app.secondthought.guardian;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

/** Asks the SecondThought server whether an incoming number appears in scam reports. Nothing is stored there. */
public final class CallerCheck {
    private CallerCheck() {}

    public interface Done { void onResult(String verdict, int reports); }

    public static void run(Context ctx, String number, Done done) {
        final Context app = ctx.getApplicationContext();
        final Handler main = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            String[] out = {"offline", "0"};
            // The free server sleeps when idle and takes up to a minute to wake: keep trying for ~75 s.
            for (int attempt = 0; attempt < 6 && "offline".equals(out[0]); attempt++) {
                if (attempt > 0) {
                    try { Thread.sleep(5000); } catch (InterruptedException e) { break; }
                }
                out = once(app, number);
            }
            final String v = out[0];
            final int r = Integer.parseInt(out[1]);
            main.post(() -> done.onResult(v, r));
        }, "caller-check").start();
    }

    /** Same rules as the server for Indian numbers: 10 digits, 0 + 10 digits, or 91 + 10 digits become +91XXXXXXXXXX. */
    static String normalize(String raw) {
        if (raw == null) return "";
        boolean plus = raw.trim().startsWith("+");
        String d = raw.replaceAll("[^0-9]", "");
        if (plus) return "+" + d;
        if (d.length() == 10) return "+91" + d;
        if (d.length() == 11 && d.startsWith("0")) return "+91" + d.substring(1);
        if (d.length() == 12 && d.startsWith("91")) return "+" + d;
        return d.isEmpty() ? "" : "+" + d;
    }

    private static String[] once(Context app, String number) {
            String verdict = "offline";
            int reports = 0;
            HttpURLConnection c = null;
            try {
                String n = normalize(number);
                if (n.replaceAll("[^0-9]", "").length() < 6) {
                    verdict = "unknown";
                } else {
                    // GET /api/graph/lookup: the scam-report lookup every SecondThought server has. Nothing is stored.
                    URL url = new URL(app.getString(R.string.api_base) + "/api/graph/lookup?kind=phone&value="
                        + java.net.URLEncoder.encode(n, "UTF-8"));
                    c = (HttpURLConnection) url.openConnection();
                    c.setConnectTimeout(10000);
                    c.setReadTimeout(15000);
                    if (c.getResponseCode() == 200) {
                        try (InputStream in = c.getInputStream()) {
                            ByteArrayOutputStream buf = new ByteArrayOutputStream();
                            byte[] b = new byte[4096];
                            int k;
                            while ((k = in.read(b)) > 0) buf.write(b, 0, k);
                            JSONObject j = new JSONObject(buf.toString("UTF-8"));
                            reports = j.optInt("reports", 0);
                            int reporters = j.optInt("reporters", 0);
                            verdict = reporters >= 3 ? "reported" : reports > 0 ? "seen" : "unknown";
                        }
                    }
                }
            } catch (Exception ignored) {
                // offline or the free server is waking up: the prompt still works, it just can't show reports
            } finally {
                if (c != null) c.disconnect();
            }
            return new String[] {verdict, String.valueOf(reports)};
    }
}
