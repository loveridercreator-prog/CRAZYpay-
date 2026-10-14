package com.crazypay.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import org.json.JSONObject;

/**
 * MainActivity: Full-featured native Android host for CrazyPay P2P Escrow & Payment Ledger.
 * Features:
 * - Local asset bundle loading from file:///android_asset/index.html
 * - Pull-to-refresh integration via SwipeRefreshLayout
 * - Dual loading indicators (horizontal top bar & center startup spinner)
 * - Offline / network error recovery with retry interface
 * - HTML5 file input chooser support (for proof/receipt uploads)
 * - Bi-directional native JavaScript bridge (window.CrazyPayBridge)
 * - Deep link intent router (crazypay:// and https://)
 * - Hardware back-stack navigation handling
 */
public class MainActivity extends Activity {

    private static final int PERMISSION_REQUEST_NOTIFICATIONS = 1001;
    private static final int FILE_CHOOSER_REQUEST_CODE = 2001;
    private static final String PREFS_NAME = "CrazyPaySecurityPrefs";
    private static final String KEY_LEDGER_SYNC = "crazypay_ledger_sync_active";
    private static final String DEFAULT_ASSET_URL = "file:///android_asset/index.html";

    private WebView mWebView;
    private SwipeRefreshLayout mSwipeRefresh;
    private ProgressBar mLoadingIndicator;
    private ProgressBar mHorizontalProgress;
    private LinearLayout mErrorLayout;
    private Button mBtnRetry;
    private SharedPreferences mPrefs;

    private ValueCallback<Uri[]> mFilePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        mPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        mWebView = findViewById(R.id.webview);
        mSwipeRefresh = findViewById(R.id.swipe_refresh);
        mLoadingIndicator = findViewById(R.id.loading_indicator);
        mHorizontalProgress = findViewById(R.id.horizontal_progress);
        mErrorLayout = findViewById(R.id.error_layout);
        mBtnRetry = findViewById(R.id.btn_retry);

        setupSwipeRefresh();
        setupWebView();
        setupErrorHandling();
        checkAndRequestNotificationPermissions();

        // Handle initial intent if app was opened via deep link
        handleIncomingIntent(getIntent());

        // Load the bundled CrazyPay web application from local assets
        loadAppInterface();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    /**
     * Parse and dispatch custom deep links (crazypay://order?id=123, upi callbacks, etc.)
     */
    private void handleIncomingIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        final Uri data = intent.getData();
        if (data != null && mWebView != null) {
            mWebView.post(new Runnable() {
                @Override
                public void run() {
                    String script = String.format(
                        "window.dispatchEvent(new CustomEvent('crazypay:deeplink', { detail: { uri: '%s' } }));",
                        data.toString().replace("'", "\\'")
                    );
                    mWebView.evaluateJavascript(script, null);
                }
            });
        }
    }

    private void setupSwipeRefresh() {
        if (mSwipeRefresh != null) {
            mSwipeRefresh.setColorSchemeColors(0xFF10B981, 0xFF059669);
            mSwipeRefresh.setProgressBackgroundColorSchemeColor(0xFF1E293B);
            mSwipeRefresh.setOnRefreshListener(new SwipeRefreshLayout.OnRefreshListener() {
                @Override
                public void onRefresh() {
                    if (mWebView != null) {
                        mWebView.reload();
                    }
                }
            });
        }
    }

    private void setupErrorHandling() {
        if (mBtnRetry != null) {
            mBtnRetry.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    showErrorView(false);
                    if (mWebView != null) {
                        mWebView.reload();
                    }
                }
            });
        }
    }

    private void showErrorView(boolean show) {
        if (mErrorLayout != null) {
            mErrorLayout.setVisibility(show ? View.VISIBLE : View.GONE);
        }
        if (mWebView != null) {
            mWebView.setVisibility(show ? View.GONE : View.VISIBLE);
        }
    }

    /**
     * Configure WebView with hardened security, DOM storage, and bridge handlers.
     */
    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = mWebView.getSettings();

        // JavaScript & Web Storage
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Viewport layout
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Security & Media
        settings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        // Custom User Agent identification
        String defaultUa = settings.getUserAgentString();
        settings.setUserAgentString(defaultUa + " CrazyPayNativeApp/3.2.0 (Android; Mobile)");

        // Expose Native JavaScript Bridge
        mWebView.addJavascriptInterface(new CrazyPayWebInterface(this), "CrazyPayBridge");

        // Custom WebViewClient
        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    return handleExternalUri(request.getUrl());
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null) {
                    return handleExternalUri(Uri.parse(url));
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (mHorizontalProgress != null) {
                    mHorizontalProgress.setVisibility(View.VISIBLE);
                }
                showErrorView(false);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (mLoadingIndicator != null) {
                    mLoadingIndicator.setVisibility(View.GONE);
                }
                if (mHorizontalProgress != null) {
                    mHorizontalProgress.setVisibility(View.GONE);
                }
                if (mSwipeRefresh != null && mSwipeRefresh.isRefreshing()) {
                    mSwipeRefresh.setRefreshing(false);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    if (mLoadingIndicator != null) {
                        mLoadingIndicator.setVisibility(View.GONE);
                    }
                    if (mSwipeRefresh != null && mSwipeRefresh.isRefreshing()) {
                        mSwipeRefresh.setRefreshing(false);
                    }
                    showErrorView(true);
                }
            }
        });

        // WebChromeClient for horizontal progress & file uploads
        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (mHorizontalProgress != null) {
                    mHorizontalProgress.setProgress(newProgress);
                    if (newProgress >= 100) {
                        mHorizontalProgress.setVisibility(View.GONE);
                    }
                }
                if (newProgress >= 80 && mLoadingIndicator != null) {
                    mLoadingIndicator.setVisibility(View.GONE);
                }
            }

            // Android 5.0+ File Chooser (for receipts / screenshots)
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;

                Intent contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentIntent.setType("image/*");

                Intent chooserIntent = Intent.createChooser(contentIntent, "Select Payment Receipt / Proof");
                try {
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception e) {
                    mFilePathCallback = null;
                    return false;
                }
            }
        });
    }

    /**
     * Intercept non-HTTP/HTTPS intents (such as upi://, telegram://, mailto://)
     */
    private boolean handleExternalUri(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null) return false;

        scheme = scheme.toLowerCase();
        if (scheme.equals("http") || scheme.equals("https") || scheme.equals("file")) {
            return false; // Render directly in native WebView
        }

        // Delegate to external intent provider (UPI apps, mail, messenger)
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (Exception e) {
            Toast.makeText(this, "No supported app installed for: " + scheme, Toast.LENGTH_SHORT).show();
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (mFilePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            mFilePathCallback.onReceiveValue(results);
            mFilePathCallback = null;
        }
    }

    /**
     * Notification permissions check for Android 13+ (API 33).
     */
    private void checkAndRequestNotificationPermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQUEST_NOTIFICATIONS);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_NOTIFICATIONS) {
            boolean isGranted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            notifyWebViewPermissionResult(isGranted);
        }
    }

    private void notifyWebViewPermissionResult(final boolean isGranted) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (mWebView != null) {
                    mWebView.evaluateJavascript(
                        String.format("window.dispatchEvent(new CustomEvent('crazypay:permission_result', { detail: { granted: %b } }));", isGranted),
                        null
                    );
                }
            }
        });
    }

    private void loadAppInterface() {
        mWebView.loadUrl(DEFAULT_ASSET_URL);
    }

    /**
     * Native JavaScript Interface exposed to the web application as `window.CrazyPayBridge`.
     */
    public class CrazyPayWebInterface {
        private final Context mContext;

        public CrazyPayWebInterface(Context context) {
            this.mContext = context;
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "3.2.0";
        }

        @JavascriptInterface
        public boolean hasNotificationPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            }
            return true;
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    checkAndRequestNotificationPermissions();
                }
            });
        }

        @JavascriptInterface
        public void syncLedgerStatus(String status) {
            mPrefs.edit().putString(KEY_LEDGER_SYNC, status).apply();
        }

        @JavascriptInterface
        public String getLedgerStatus() {
            return mPrefs.getString(KEY_LEDGER_SYNC, "active");
        }

        @JavascriptInterface
        public void showToast(final String message) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public String getDeviceInfo() {
            try {
                JSONObject info = new JSONObject();
                info.put("platform", "android");
                info.put("osVersion", Build.VERSION.RELEASE);
                info.put("sdkInt", Build.VERSION.SDK_INT);
                info.put("manufacturer", Build.MANUFACTURER);
                info.put("model", Build.MODEL);
                info.put("appVersion", "3.2.0");
                return info.toString();
            } catch (Exception e) {
                return "{\"platform\":\"android\"}";
            }
        }

        @JavascriptInterface
        public void openExternalUrl(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (url != null) {
                        handleExternalUri(Uri.parse(url));
                    }
                }
            });
        }
    }

    /**
     * Handle hardware back button navigation in the WebView.
     */
    @Override
    public void onBackPressed() {
        if (mWebView != null && mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (mWebView != null) {
            mWebView.destroy();
        }
        super.onDestroy();
    }
}
