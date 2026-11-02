"""Experimental read-only Groobarbs integration; manual installation only."""
from datetime import timedelta
import logging
import voluptuous as vol
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_track_time_interval
from .client import Client, GroobarbsError

_LOGGER=logging.getLogger(__name__)
CONFIG_SCHEMA=vol.Schema({vol.Optional('groobarbs'):vol.Schema({vol.Required('email'):cv.string,vol.Required('password'):cv.string})},extra=vol.ALLOW_EXTRA)

async def async_setup(hass, config):
    if 'groobarbs' not in config: return True
    cfg=config['groobarbs']; client=Client(cfg['email'],cfg['password'])
    hass.data['groobarbs']={'client':client}
    async def refresh(_=None):
        try:
            await client.login()
            preview=await client.read()
            hass.states.async_set('sensor.groobarbs_next_delivery',preview['date'] or 'unknown',{'friendly_name':'Groobarbs next delivery',**preview})
        except (GroobarbsError,TimeoutError):
            hass.states.async_set('sensor.groobarbs_next_delivery','unavailable',{'friendly_name':'Groobarbs next delivery'})
            _LOGGER.warning('Groobarbs refresh failed; check credentials or website compatibility')
        except Exception:
            # Do not log response bodies or credential-bearing exceptions.
            hass.states.async_set('sensor.groobarbs_next_delivery','unavailable')
            _LOGGER.warning('Groobarbs connection failed')
    async def stop(_): await client.close()
    hass.bus.async_listen_once('homeassistant_stop',stop)
    async_track_time_interval(hass,refresh,timedelta(minutes=30))
    await refresh()
    return True
