package app.secondthought.guardian;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** "Not now" on the unknown-caller prompt: just remove it. Nothing is recorded. */
public class DismissReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        CallNotifier.cancelIncoming(ctx);
    }
}
