package app.secondthought.guardian;

import android.content.Context;
import android.net.Uri;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Reads the text in a screenshot ON THE PHONE (Google ML Kit, bundled models: no internet, nothing uploaded).
 * Runs the Devanagari reader first (it also reads Latin letters); if the image has little Hindi script,
 * the Latin reader's result is used instead, since it is more accurate for English.
 */
final class ScreenshotReader {
    interface Done { void onText(String text, String script); void onError(String message); }

    private ScreenshotReader() {}

    static void read(Context ctx, Uri uri, Done done) {
        final InputImage image;
        try {
            image = InputImage.fromFilePath(ctx, uri);
        } catch (Exception e) {
            done.onError("Couldn't open that image.");
            return;
        }
        final TextRecognizer deva = TextRecognition.getClient(new DevanagariTextRecognizerOptions.Builder().build());
        deva.process(image).addOnSuccessListener(dt -> {
            final String devaText = dt.getText();
            if (devanagariShare(devaText) >= 0.2) {
                deva.close();
                done.onText(devaText, "devanagari");
                return;
            }
            deva.close();
            final TextRecognizer latin = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            latin.process(image).addOnSuccessListener(lt -> {
                latin.close();
                String t = lt.getText();
                done.onText(t.trim().isEmpty() ? devaText : t, "latin");
            }).addOnFailureListener(e -> { latin.close(); done.onText(devaText, "devanagari"); });
        }).addOnFailureListener(e -> {
            deva.close();
            final TextRecognizer latin = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            latin.process(image).addOnSuccessListener(lt -> { latin.close(); done.onText(lt.getText(), "latin"); })
                .addOnFailureListener(e2 -> { latin.close(); done.onError("Couldn't read text in that image."); });
        });
    }

    private static double devanagariShare(String s) {
        int letters = 0, deva = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isLetter(c)) { letters++; if (c >= 0x0900 && c <= 0x097F) deva++; }
        }
        return letters == 0 ? 0 : (double) deva / letters;
    }
}
