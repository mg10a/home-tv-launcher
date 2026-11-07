package uk.homecinema.launcher;

import android.graphics.Insets;
import android.view.View;
import android.view.WindowInsets;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.assertEquals;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class WindowInsetsTest {
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
