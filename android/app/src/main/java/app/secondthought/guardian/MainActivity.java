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
     * Keep the app's screen between them (and above the keyboard), so nothing is hidden or overlapped.
     */
    private void keepInsideSafeArea() {
        final View web = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.LayoutParams lp = v.getLayoutParams();
            if (lp instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams m = (ViewGroup.MarginLayoutParams) lp;
                m.topMargin = bars.top;
                m.bottomMargin = Math.max(bars.bottom, ime.bottom);
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
