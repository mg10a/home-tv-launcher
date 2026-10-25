package io.github.mg10a.hometvdev;

import android.app.Activity;
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
  private WebView web;
  private final ExecutorService pool=Executors.newFixedThreadPool(3);
  private static final String LAUNCHER="https://mg10a.github.io/home-tv-launcher/dev/?v=3.71";
  @Override public void onCreate(Bundle b){super.onCreate(b);
    web=new WebView(this);setContentView(web);
    web.setBackgroundColor(Color.BLACK);
    WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setMediaPlaybackRequiresUserGesture(false);
    web.addJavascriptInterface(new Bridge(),"HomeTVNative");
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !r.getUrl().toString().startsWith("https://mg10a.github.io/home-tv-launcher/");}
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
  @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
}
