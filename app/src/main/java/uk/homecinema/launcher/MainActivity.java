package uk.homecinema.launcher;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.net.Uri;
import android.webkit.WebSettings;
import android.widget.Toast;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private WebView web;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                // Keep GitHub Pages dashboard and its OAuth return within the WebView.
                if ("https".equals(uri.getScheme()) && "mg10a.github.io".equals(uri.getHost())
                    && uri.getPath() != null && uri.getPath().startsWith("/home-tv-launcher/")) return false;
                // Let Android handle sign-in and external URLs without replacing the dashboard.
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                return true;
            }
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        web.addJavascriptInterface(new LauncherBridge(), "AndroidLauncher");
        setContentView(web);
        web.loadUrl("https://mg10a.github.io/home-tv-launcher/");
    }
    private class LauncherBridge {
        @JavascriptInterface public void openApp(String name) {
            runOnUiThread(() -> launch(name));
        }
    }
    private void launch(String name) {
        if ("Disney+".equals(name) || "Apple TV".equals(name)) return;
        String[] candidates;
        switch(name) {
            case "JustWatch": candidates = new String[]{"com.justwatch.justwatch"}; break;
            case "Netflix": candidates = new String[]{"com.netflix.mediaclient"}; break;
            case "YouTube": candidates = new String[]{"com.google.android.youtube"}; break;
            case "BBC iPlayer": candidates = new String[]{"bbc.iplayer.android"}; break;
            case "ITVX": candidates = new String[]{"air.ITVMobilePlayer"}; break;
            case "Prime Video": candidates = new String[]{"com.amazon.avod.thirdpartyclient"}; break;
            case "NOW": candidates = new String[]{"com.bskyb.nowtv.beta", "com.bskyb.nowtv"}; break;
            case "Spotify": candidates = new String[]{"com.spotify.music"}; break;
            default: candidates = new String[]{};
        }
        PackageManager pm = getPackageManager();
        for (String pkg : candidates) {
            Intent intent = pm.getLaunchIntentForPackage(pkg);
            if (intent != null) {
                try { startActivity(intent); return; } catch(Exception ignored) {}
            }
        }
        // Resolve by installed launcher app label, avoiding browser links entirely.
        Intent query = new Intent(Intent.ACTION_MAIN);
        query.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> matches = pm.queryIntentActivities(query, 0);
        String wanted = name.toLowerCase(Locale.ROOT);
        for (ResolveInfo match : matches) {
            String label = match.loadLabel(pm).toString().toLowerCase(Locale.ROOT);
            boolean same = label.equals(wanted) ||
                ("now".equals(wanted) && label.startsWith("now")) ||
                ("bbc iplayer".equals(wanted) && label.contains("iplayer")) ||
                ("itvx".equals(wanted) && label.contains("itvx")) ||
                ("prime video".equals(wanted) && label.contains("prime video"));
            if (same && match.activityInfo != null) {
                Intent intent = new Intent(Intent.ACTION_MAIN);
                intent.addCategory(Intent.CATEGORY_LAUNCHER);
                intent.setClassName(match.activityInfo.packageName, match.activityInfo.name);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { startActivity(intent); return; } catch(Exception ignored) {}
            }
        }
        Toast.makeText(this, name + " app not found or launch unavailable", Toast.LENGTH_LONG).show();
    }
    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
