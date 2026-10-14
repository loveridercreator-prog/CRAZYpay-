package com.crazypay.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

/**
 * CrazyPayApp: Global Application initialization for CrazyPay Android platform.
 */
public class CrazyPayApp extends Application {

    public static final String CHANNEL_TRANSACTIONS_ID = "crazypay_transactions_channel";
    public static final String CHANNEL_ESCROW_ID = "crazypay_escrow_channel";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    /**
     * Set up notification channels for Android 8.0 (API 26) and above.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Transaction & Ledger channel
            CharSequence transName = getString(R.string.notification_channel_name);
            String transDesc = getString(R.string.notification_channel_desc);
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel transChannel = new NotificationChannel(
                    CHANNEL_TRANSACTIONS_ID,
                    transName,
                    importance
            );
            transChannel.setDescription(transDesc);
            transChannel.enableLights(true);
            transChannel.enableVibration(true);

            // Escrow channel
            NotificationChannel escrowChannel = new NotificationChannel(
                    CHANNEL_ESCROW_ID,
                    "CrazyPay Escrow Updates",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            escrowChannel.setDescription("Alerts for escrow hold, release, and order dispute resolutions");

            manager.createNotificationChannel(transChannel);
            manager.createNotificationChannel(escrowChannel);
        }
    }
}
