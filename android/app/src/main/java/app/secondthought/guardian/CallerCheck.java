package app.secondthought.guardian;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
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

    private static String[] once(Context app, String number) {
            String verdict = "offline";
            int reports = 0;
            HttpURLConnection c = null;
            try {
                if (number == null || number.replaceAll("[^0-9]", "").length() < 3) {
                    verdict = "unknown";
                } else {
                    URL url = new URL(app.getString(R.string.api_base) + "/api/caller-check");
                    c = (HttpURLConnection) url.openConnection();
                    c.setConnectTimeout(10000);
                    c.setReadTimeout(15000);
                    c.setRequestMethod("POST");
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", "application/json");
                    byte[] body = new JSONObject().put("number", number).toString().getBytes(StandardCharsets.UTF_8);
                    try (OutputStream os = c.getOutputStream()) { os.write(body); }
                    if (c.getResponseCode() == 200) {
                        try (InputStream in = c.getInputStream()) {
                            ByteArrayOutputStream buf = new ByteArrayOutputStream();
                            byte[] b = new byte[4096];
                            int n;
                            while ((n = in.read(b)) > 0) buf.write(b, 0, n);
                            JSONObject j = new JSONObject(buf.toString("UTF-8"));
                            verdict = j.optString("verdict", "unknown");
                            reports = j.optInt("reports", 0);
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
