package uk.homecinema.launcher;
import android.content.ComponentName;
import android.content.pm.ActivityInfo;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class RotationConfigTest {
  @Test public void webViewActivityHandlesRotationWithoutRecreation() throws Exception {
    MainActivity activity=Robolectric.buildActivity(MainActivity.class).setup().get();
    ActivityInfo info=activity.getPackageManager().getActivityInfo(new ComponentName(activity,MainActivity.class),0);
    assertNotEquals(0,info.configChanges & ActivityInfo.CONFIG_ORIENTATION);
    assertNotEquals(0,info.configChanges & ActivityInfo.CONFIG_SCREEN_SIZE);
    assertNotEquals(0,info.configChanges & ActivityInfo.CONFIG_SMALLEST_SCREEN_SIZE);
  }
}
