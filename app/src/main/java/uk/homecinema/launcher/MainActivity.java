package uk.homecinema.launcher;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Bundle;
import android.webkit.*;
import android.widget.*;
import android.view.View;
import android.graphics.Color;
import android.util.Base64;
import org.json.JSONObject;
import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
  private WebView web,authWeb;
  private final ExecutorService pool=Executors.newFixedThreadPool(3);
  private static final String LAUNCHER="https://mg10a.github.io/home-tv-launcher/?v=4.0";
  @Override public void onCreate(Bundle b){super.onCreate(b);
    web=new WebView(this);setContentView(web);
    web.setBackgroundColor(Color.BLACK);
    web.setPadding(0,0,0,0);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN);
    WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setMediaPlaybackRequiresUserGesture(false);
    web.addJavascriptInterface(new Bridge(),"HomeTVNative");
    web.addJavascriptInterface(new LauncherBridge(),"AndroidLauncher");
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !isLauncher(r.getUrl());}
      @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
        String url=r.getUrl().toString();
        if(!url.contains("/api/eufy_viewer/playback/"))return null;
        String base=webBase,token=webToken;
        if(base==null||token==null||!url.startsWith(base+"/api/eufy_viewer/playback/"))return null;
        try {
          HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(12000);c.setReadTimeout(30000);
          c.setRequestProperty("Authorization","Bearer "+token);
          String range=r.getRequestHeaders().get("Range");if(range!=null)c.setRequestProperty("Range",range);
          int status=c.getResponseCode();if(status!=200&&status!=206)return null;
          Map<String,String> h=new HashMap<>();
          for(String key:new String[]{"Content-Range","Accept-Ranges","Content-Length"}){String value=c.getHeaderField(key);if(value!=null)h.put(key,value);}
          return new WebResourceResponse(c.getContentType()==null?"video/mp4":c.getContentType(),"binary",status,status==206?"Partial Content":"OK",h,c.getInputStream());
        }catch(Exception e){return null;}
      }
    });
    web.loadUrl(LAUNCHER);
  }

  public final class LauncherBridge {
    @JavascriptInterface public void openAuth(String url){runOnUiThread(()->beginAuth(url));}
    @JavascriptInterface public void openApp(String name) {
      runOnUiThread(() -> launchEntertainment(name));
    }
  }
  private void launchEntertainment(String name) {
    String[] names={"NOW","Netflix","Disney+","YouTube","BBC iPlayer","ITVX","Prime Video","Apple TV","Spotify","JustWatch","NordVPN"};
    if(!Arrays.asList(names).contains(name))return;
    PackageManager pm=getPackageManager();
    // Query both TV and phone launchers so the installed platform variant is used.
    for(String category:new String[]{Intent.CATEGORY_LEANBACK_LAUNCHER,Intent.CATEGORY_LAUNCHER}) {
      Intent query=new Intent(Intent.ACTION_MAIN).addCategory(category);
      for(ResolveInfo match:pm.queryIntentActivities(query,0)) {
        if(match.activityInfo==null)continue;
        String label=match.loadLabel(pm).toString().trim();
        boolean same=label.equalsIgnoreCase(name)
          || ("Prime Video".equals(name)&&label.equalsIgnoreCase("Amazon Prime Video"))
          || ("BBC iPlayer".equals(name)&&label.equalsIgnoreCase("iPlayer"))
          || ("NOW".equals(name)&&(match.activityInfo.packageName.equals("com.nowtv.ie")
            ||match.activityInfo.packageName.equals("com.bskyb.nowtv.beta")
            ||label.equalsIgnoreCase("NOW TV")||label.equalsIgnoreCase("NOWTV")));
        if(!same)continue;
        Intent launch=new Intent(Intent.ACTION_MAIN).addCategory(category);
        launch.setClassName(match.activityInfo.packageName,match.activityInfo.name);
        try{startActivity(launch);return;}catch(android.content.ActivityNotFoundException|SecurityException ignored){}
      }
    }
    Toast.makeText(this,name+" app not found. Check it is installed on this device.",Toast.LENGTH_LONG).show();
  }

  private boolean isLauncher(android.net.Uri uri) {
    return "https".equals(uri.getScheme())&&"mg10a.github.io".equals(uri.getHost())
      &&(uri.getPort()==-1||uri.getPort()==443)&&uri.getUserInfo()==null
      &&("/home-tv-launcher/".equals(uri.getPath())||"/home-tv-launcher/index.html".equals(uri.getPath()));
  }
  private void closeAuth(){
    if(authWeb!=null){WebView old=authWeb;authWeb=null;setContentView(web);old.destroy();}
  }
  private void beginAuth(String url){
    android.net.Uri uri=android.net.Uri.parse(url);
    String host=uri.getHost(),redirect=uri.getQueryParameter("redirect_uri");
    if(!"https".equals(uri.getScheme())||host==null||!host.endsWith(".ui.nabu.casa")
      ||uri.getUserInfo()!=null||(uri.getPort()!=-1&&uri.getPort()!=443)
      ||!"/auth/authorize".equals(uri.getPath())||redirect==null
      ||!isLauncher(android.net.Uri.parse(redirect))){
      Toast.makeText(this,"Invalid Home Assistant sign-in address",Toast.LENGTH_LONG).show();return;
    }
    closeAuth();
    // Login pages never receive the launcher's privileged JavaScript interfaces.
    authWeb=new WebView(this);
    authWeb.getSettings().setJavaScriptEnabled(true);
    authWeb.getSettings().setDomStorageEnabled(true);
    authWeb.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        android.net.Uri next=request.getUrl();
        if(request.isForMainFrame()&&isLauncher(next)){
          String callback=next.toString();
          web.post(()->{closeAuth();web.loadUrl(callback);});return true;
        }
        return !"https".equals(next.getScheme())||!host.equals(next.getHost())
          ||next.getUserInfo()!=null||(next.getPort()!=-1&&next.getPort()!=443);
      }
    });
    setContentView(authWeb);authWeb.loadUrl(url);
  }

  private volatile String webBase,webToken;
  public final class Bridge {
    @JavascriptInterface public void request(String id,String base,String token,String path,String method){
      pool.execute(()->{
        String data="";int status=500;
        try {
          URI uri=new URI(base);String host=uri.getHost();
          if(!"https".equalsIgnoreCase(uri.getScheme())||host==null||(!host.endsWith(".ui.nabu.casa")&&!host.equals("localhost")))throw new SecurityException("Only HTTPS Nabu Casa hosts supported");
          if(!path.startsWith("/api/eufy_viewer/")||path.contains(".."))throw new SecurityException("Invalid API path");
          if(token.length()<10)throw new SecurityException("Missing HA token");
          webBase=base.replaceAll("/+$","");webToken=token;
          HttpURLConnection c=(HttpURLConnection)new URL(webBase+path).openConnection();c.setConnectTimeout(12000);c.setReadTimeout(30000);
          c.setRequestProperty("Authorization","Bearer "+token);c.setRequestProperty("Accept","application/json");
          c.setRequestMethod("POST".equals(method)?"POST":"GET");
          if("POST".equals(method)){c.setDoOutput(true);c.getOutputStream().close();}
          status=c.getResponseCode();
          InputStream in=status>=400?c.getErrorStream():c.getInputStream();
          if(in!=null){byte[] bytes=in.readNBytes(2_000_000);data=Base64.encodeToString(bytes,Base64.NO_WRAP);}
          c.disconnect();
        }catch(Exception e){data=Base64.encodeToString(("{\"error\":"+JSONObject.quote(e.toString())+"}").getBytes(),Base64.NO_WRAP);}
        final String js="window.HomeTVNativeResponse("+JSONObject.quote(id)+","+status+","+JSONObject.quote(data)+")";
        runOnUiThread(()->web.evaluateJavascript(js,null));
      });
    }
  }
  @Override public void onBackPressed(){if(authWeb!=null){closeAuth();return;}if(web.canGoBack())web.goBack();else super.onBackPressed();}
}
