package uk.homecinema.launcher;

import android.net.Uri;
import android.os.Looper;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.Map;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
@LooperMode(LooperMode.Mode.PAUSED)
public class AuthReturnTest {
  private WebView field(MainActivity activity,String name) throws Exception {
    Field field=MainActivity.class.getDeclaredField(name);
    field.setAccessible(true);
    return (WebView)field.get(activity);
  }
  private WebResourceRequest request(String url) {
    return new WebResourceRequest() {
      public Uri getUrl(){return Uri.parse(url);}
      public boolean isForMainFrame(){return true;}
      public boolean isRedirect(){return false;}
      public boolean hasGesture(){return false;}
      public String getMethod(){return "GET";}
      public Map<String,String> getRequestHeaders(){return Collections.emptyMap();}
    };
  }
  @Test public void loginReturnsToDetachedLauncherWithoutWaitingForReattachment() throws Exception {
    MainActivity activity=Robolectric.buildActivity(MainActivity.class).setup().visible().get();
    WebView launcher=field(activity,"web");
    Method begin=MainActivity.class.getDeclaredMethod("beginAuth",String.class);
    begin.setAccessible(true);
    begin.invoke(activity,"https://test.ui.nabu.casa/auth/authorize?redirect_uri=https%3A%2F%2Fmg10a.github.io%2Fhome-tv-launcher%2F");
    WebView login=field(activity,"authWeb");
    assertNotNull(login);
    assertNull("Launcher is detached while login is visible",launcher.getParent());
    assertTrue(login.getWebViewClient().shouldOverrideUrlLoading(login,
      request("https://mg10a.github.io/home-tv-launcher/?code=test-code&state=test-state")));
    shadowOf(Looper.getMainLooper()).idle();
    assertNull("Login must close after callback",field(activity,"authWeb"));
    assertNotNull("Launcher must reattach",launcher.getParent());
    assertEquals("https://mg10a.github.io/home-tv-launcher/?code=test-code&state=test-state",
      shadowOf(launcher).getLastLoadedUrl());
  }
}
