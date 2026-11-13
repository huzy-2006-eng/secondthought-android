package app.secondthought.guardian;

import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

/**
 * Android calls this ONLY for incoming numbers that are not in the phone's contacts (Android 10+, once the
 * person makes SecondThought their call-screening app). Saved contacts never reach this code.
 *
 * We never block, silence or record the call. We let it ring normally and show one question:
 * "Unknown number calling. Protect this call?"
 */
@RequiresApi(api = Build.VERSION_CODES.Q)
public class ScreeningService extends CallScreeningService {
    @Override
    public void onScreenCall(@NonNull Call.Details details) {
        // Always let the call through unchanged, immediately.
        respondToCall(details, new CallResponse.Builder().build());
        if (details.getCallDirection() != Call.Details.DIRECTION_INCOMING) return;
        if (!getSharedPreferences("secondthought", MODE_PRIVATE).getBoolean("unknown_call_prompt", true)) return;

        Uri handle = details.getHandle();
        final String number = handle == null ? "" : handle.getSchemeSpecificPart();
        CallNotifier.showIncoming(this, number, false, null, 0);
        CallerCheck.run(this, number, (verdict, reports) -> CallNotifier.showIncoming(this, number, false, verdict, reports));
    }
}
