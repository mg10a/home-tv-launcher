package uk.homecinema.launcher;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Build;
import android.webkit.*;
import android.widget.*;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.graphics.Color;
import android.util.Base64;
import org.json.JSONObject;
import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
  private WebView web,authWeb;
  private final android.os.Handler mainHandler=new android.os.Handler(android.os.Looper.getMainLooper());
  private final ExecutorService pool=Executors.newFixedThreadPool(3);
  private static final String LAUNCHER="https://mg10a.github.io/home-tv-launcher/?v=4.1.4";
  private static final String VTECH_PACKAGE="com.cams.vtech.mvb.pro";
  @Override public void onCreate(Bundle b){super.onCreate(b);
    web=new WebView(this);setContentView(web);
    web.setBackgroundColor(Color.BLACK);
    fitWebViewsToWindow();
    updateSystemBars(getResources().getConfiguration());
    WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setMediaPlaybackRequiresUserGesture(false);
    web.addJavascriptInterface(new Bridge(),"HomeTVNative");
    web.addJavascriptInterface(new LauncherBridge(),"AndroidLauncher");
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){if(r.isForMainFrame() && isSamsungFood(r.getUrl())){new LauncherBridge().openSamsungFood(r.getUrl().toString());return true;}if(r.isForMainFrame() && isGroobarbs(r.getUrl())){new LauncherBridge().openGroobarbs();return true;}return !isLauncher(r.getUrl());}
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
    // Fetch current HTML on a cold launch without clearing sign-in or album preferences.
    // Versioned CSS/JS can still use the normal resource cache.
    web.loadUrl(LAUNCHER+"&launch="+UUID.randomUUID(),Collections.singletonMap("Cache-Control","no-cache"));
  }

  private void fitWebViewsToWindow() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;

    // Android 15 draws behind the system bars. Size the WebView inside their
    // insets so viewport units and fixed dialogs use the available screen.
    getWindow().setDecorFitsSystemWindows(false);
    getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    View content=findViewById(android.R.id.content);
    content.setBackgroundColor(Color.BLACK);
    content.setOnApplyWindowInsetsListener((view, insets) -> {
      android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()
        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
      view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
      return WindowInsets.CONSUMED;
    });
    content.requestApplyInsets();
  }

  private void updateSystemBars(Configuration config) {
    boolean immersive=authWeb==null&&config.orientation==Configuration.ORIENTATION_LANDSCAPE
      &&config.smallestScreenWidthDp<600
      &&getPackageManager().hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.R) {
      WindowInsetsController controller=getWindow().getInsetsController();
      if(controller==null)return;
      controller.setSystemBarsBehavior(immersive
        ?WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        :WindowInsetsController.BEHAVIOR_DEFAULT);
      controller.hide(WindowInsets.Type.statusBars());
      if(immersive)controller.hide(WindowInsets.Type.navigationBars());
      else controller.show(WindowInsets.Type.navigationBars());
      return;
    }
    int flags=View.SYSTEM_UI_FLAG_FULLSCREEN;
    if(immersive)flags|=View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
    getWindow().getDecorView().setSystemUiVisibility(flags);
  }

  @Override public void onConfigurationChanged(Configuration config) {
    super.onConfigurationChanged(config);
    updateSystemBars(config);
  }

  @Override public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if(hasFocus)updateSystemBars(getResources().getConfiguration());
  }

  public final class LauncherBridge {
    @JavascriptInterface public boolean managesViewportInsets(){return true;}
    @JavascriptInterface public void openSamsungFood(String url){runOnUiThread(()->{
      android.net.Uri uri=android.net.Uri.parse(url);
      if(!isSamsungFood(uri))return;
      try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}
      catch(android.content.ActivityNotFoundException|SecurityException e){Toast.makeText(MainActivity.this,"Install a browser or Samsung Food to open this link.",Toast.LENGTH_LONG).show();}
    });}
    @JavascriptInterface public void openGroobarbs(){runOnUiThread(()->{
      try{startActivity(new Intent(Intent.ACTION_VIEW,android.net.Uri.parse("https://my.groobarbs.co.uk/")));}
      catch(android.content.ActivityNotFoundException|SecurityException e){Toast.makeText(MainActivity.this,"No browser available. Use Manage box in the dashboard for contents and swaps.",Toast.LENGTH_LONG).show();}
    });}
    @JavascriptInterface public void openAuth(String url){runOnUiThread(()->beginAuth(url));}
    @JavascriptInterface public boolean supportsAudioApps() { return true; }
    @JavascriptInterface public boolean supportsBabyMonitorApp() { return true; }
    @JavascriptInterface public boolean babyMonitorInstalled() {
      PackageManager pm=getPackageManager();
      return pm.getLaunchIntentForPackage(VTECH_PACKAGE)!=null
        ||pm.getLeanbackLaunchIntentForPackage(VTECH_PACKAGE)!=null;
    }
    // Expose only the installed app's public icon; never camera data or credentials.
    @JavascriptInterface public String babyMonitorIcon() {
      try {
        android.graphics.drawable.Drawable icon=getPackageManager().getApplicationIcon(VTECH_PACKAGE);
        android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(144,144,android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas=new android.graphics.Canvas(bitmap);
        icon.setBounds(0,0,144,144);
        icon.draw(canvas);
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);
        bitmap.recycle();
        return "data:image/png;base64,"+Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP);
      } catch(PackageManager.NameNotFoundException|SecurityException e) { return ""; }
    }

    @JavascriptInterface public void openApp(String name) {
      runOnUiThread(() -> launchEntertainment(name));
    }
  }
  private void launchEntertainment(String name) {
    String[] names={"NOW","Netflix","Disney+","YouTube","BBC iPlayer","ITVX","Prime Video","Apple TV","Spotify","JustWatch","NordVPN","Sonos","Yoto","MyVTech Baby Pro"};
    if(!Arrays.asList(names).contains(name))return;
    PackageManager pm=getPackageManager();
    String[] packages="Yoto".equals(name)?new String[]{"com.yotoplay.yoto"}:"Sonos".equals(name)?new String[]{"com.sonos.acr2","com.sonos.acr"}:"MyVTech Baby Pro".equals(name)?new String[]{VTECH_PACKAGE}:new String[0];
    for(String pkg:packages){
      Intent launch=pm.getLaunchIntentForPackage(pkg);
      if(launch==null)launch=pm.getLeanbackLaunchIntentForPackage(pkg);
      if(launch!=null){try{startActivity(launch);return;}catch(android.content.ActivityNotFoundException|SecurityException ignored){}}
    }
    // Query both TV and phone launchers so the installed platform variant is used.
    for(String category:new String[]{Intent.CATEGORY_LEANBACK_LAUNCHER,Intent.CATEGORY_LAUNCHER}) {
      Intent query=new Intent(Intent.ACTION_MAIN).addCategory(category);
      for(ResolveInfo match:pm.queryIntentActivities(query,0)) {
        if(match.activityInfo==null)continue;
        String label=match.loadLabel(pm).toString().trim();
        boolean same="MyVTech Baby Pro".equals(name)
          ?VTECH_PACKAGE.equals(match.activityInfo.packageName)
          :label.equalsIgnoreCase(name)
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

  private boolean isSamsungFood(android.net.Uri uri) {
    String path=uri.getPath();
    return "https".equals(uri.getScheme()) && "app.samsungfood.com".equals(uri.getHost())
      && uri.getUserInfo()==null && (uri.getPort()==-1||uri.getPort()==443)
      && path!=null && path.matches("^/(meal-plan|shopping-list|recipe-box|recipes)(/.*)?$");
  }

  private boolean isGroobarbs(android.net.Uri uri) {
    return "https".equals(uri.getScheme()) && "my.groobarbs.co.uk".equals(uri.getHost())
      && uri.getUserInfo()==null && (uri.getPort()==-1||uri.getPort()==443);
  }

  private boolean isLauncher(android.net.Uri uri) {
    return "https".equals(uri.getScheme())&&"mg10a.github.io".equals(uri.getHost())
      &&(uri.getPort()==-1||uri.getPort()==443)&&uri.getUserInfo()==null
      &&("/home-tv-launcher/".equals(uri.getPath())||"/home-tv-launcher/index.html".equals(uri.getPath()));
  }
  private void closeAuth(){
    if(authWeb!=null){WebView old=authWeb;authWeb=null;setContentView(web);old.destroy();updateSystemBars(getResources().getConfiguration());}
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
          // The launcher is detached during login: View.post waits for reattachment.
          // Use the main looper so this callback can reattach it in the first place.
          mainHandler.post(()->{
            if(authWeb!=view)return;
            closeAuth();web.loadUrl(callback);
          });return true;
        }
        return !"https".equals(next.getScheme())||!host.equals(next.getHost())
          ||next.getUserInfo()!=null||(next.getPort()!=-1&&next.getPort()!=443);
      }
    });
    setContentView(authWeb);updateSystemBars(getResources().getConfiguration());authWeb.loadUrl(url);
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
