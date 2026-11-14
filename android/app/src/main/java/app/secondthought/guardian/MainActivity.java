package app.secondthought.guardian;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecondThoughtPlugin.class);
        super.onCreate(savedInstanceState);
        keepInsideSafeArea();
        LaunchQueue.offer(this, getIntent());
    }

    /**
     * New Android versions draw apps edge to edge, under the status bar and the gesture bar.
     * Keep the app's screen between them, so nothing is hidden or overlapped. (The keyboard is handled by Android.)
     */
    private void keepInsideSafeArea() {
        final View web = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());

            ViewGroup.LayoutParams lp = v.getLayoutParams();
            if (lp instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams m = (ViewGroup.MarginLayoutParams) lp;
                m.topMargin = bars.top;
                // Only the system bars: Android already resizes the window for the keyboard (adjustResize).
                // Adding the keyboard height here as well shrank the app twice and left a black gap.
                m.bottomMargin = bars.bottom;
                m.leftMargin = bars.left;
                m.rightMargin = bars.right;
                v.setLayoutParams(m);
            }
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(web);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        LaunchQueue.offer(this, intent);
    }
}
