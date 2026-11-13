package app.secondthought.guardian;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecondThoughtPlugin.class);
        super.onCreate(savedInstanceState);
        LaunchQueue.offer(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        LaunchQueue.offer(this, intent);
    }
}
