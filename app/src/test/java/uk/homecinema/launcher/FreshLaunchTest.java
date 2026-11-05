package uk.homecinema.launcher;
import android.net.Uri;
import android.webkit.WebView;
import java.lang.reflect.Field;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class FreshLaunchTest {
 private WebView launch() throws Exception {
  MainActivity activity=Robolectric.buildActivity(MainActivity.class).setup().get();
  Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);
  return (WebView)field.get(activity);
 }
 @Test public void coldLaunchDoesNotReuseCachedNavigationUrl() throws Exception {
  WebView first=launch(),second=launch();
  Uri a=Uri.parse(shadowOf(first).getLastLoadedUrl()),b=Uri.parse(shadowOf(second).getLastLoadedUrl());
  assertEquals("https",a.getScheme());assertEquals("mg10a.github.io",a.getHost());
  assertEquals("/home-tv-launcher/",a.getPath());
  assertNotNull(a.getQueryParameter("launch"));
  assertNotEquals(a.getQueryParameter("launch"),b.getQueryParameter("launch"));
  assertTrue(first.getSettings().getDomStorageEnabled());
 }
}
