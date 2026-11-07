package uk.homecinema.launcher;

import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Insets;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.assertEquals;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class WindowInsetsTest {
  @Test public void landscapePhoneRevealsNavigationBarsByEdgeSwipe() {
    MainActivity activity=Robolectric.buildActivity(MainActivity.class).setup().visible().get();
    shadowOf(activity.getPackageManager()).setSystemFeature(PackageManager.FEATURE_TOUCHSCREEN,true);
    Configuration config=new Configuration(activity.getResources().getConfiguration());
    config.smallestScreenWidthDp=360;
    config.orientation=Configuration.ORIENTATION_LANDSCAPE;
    activity.onConfigurationChanged(config);
    WindowInsetsController controller=activity.getWindow().getInsetsController();
    assertEquals(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE,
      controller.getSystemBarsBehavior());

    config.orientation=Configuration.ORIENTATION_PORTRAIT;
    activity.onConfigurationChanged(config);
    assertEquals(WindowInsetsController.BEHAVIOR_DEFAULT,controller.getSystemBarsBehavior());
  }

  @Test public void fitsTheWebViewAsSystemBarsMove() {
    MainActivity activity=Robolectric.buildActivity(MainActivity.class).setup().get();
    View content=activity.findViewById(android.R.id.content);
    int nav=WindowInsets.Type.navigationBars();
    int cutout=WindowInsets.Type.displayCutout();
    int ime=WindowInsets.Type.ime();

    content.dispatchApplyWindowInsets(new WindowInsets.Builder()
      .setInsets(nav,Insets.of(0,0,48,0))
      .setInsets(cutout,Insets.of(32,0,0,0)).build());
    assertEquals(32,content.getPaddingLeft());
    assertEquals(48,content.getPaddingRight());
    assertEquals(0,content.getPaddingBottom());

    content.dispatchApplyWindowInsets(new WindowInsets.Builder()
      .setInsets(nav,Insets.of(0,0,0,48))
      .setInsets(ime,Insets.of(0,0,0,200)).build());
    assertEquals(0,content.getPaddingLeft());
    assertEquals(0,content.getPaddingRight());
    assertEquals(200,content.getPaddingBottom());

    content.dispatchApplyWindowInsets(new WindowInsets.Builder()
      .setInsets(nav,Insets.of(0,0,0,48)).build());
    assertEquals(48,content.getPaddingBottom());
  }
}
