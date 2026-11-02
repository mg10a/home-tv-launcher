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
    return True

async def async_setup_entry(hass, entry):
    cfg=entry.data; client=Client(cfg['email'],cfg['password'])
    hass.data['groobarbs']={'client':client}
    async def refresh(_=None):
        try:
            if not getattr(client, '_signed_in', False):
                await client.login()
                client._signed_in = True
            preview=await client.read()
            hass.states.async_set('sensor.groobarbs_next_delivery',preview['date'] or 'unknown',{'friendly_name':'Groobarbs next delivery',**preview})
        except (GroobarbsError,TimeoutError):
            client._signed_in = False
            hass.states.async_set('sensor.groobarbs_next_delivery','unavailable',{'friendly_name':'Groobarbs next delivery'})
            _LOGGER.warning('Groobarbs refresh failed; check credentials or website compatibility')
        except Exception:
            # Do not log response bodies or credential-bearing exceptions.
            hass.states.async_set('sensor.groobarbs_next_delivery','unavailable')
            _LOGGER.warning('Groobarbs connection failed')
    async def stop(_): await client.close()
    hass.bus.async_listen_once('homeassistant_stop',stop)
    entry.async_on_unload(async_track_time_interval(hass,refresh,timedelta(minutes=30)))
    await refresh()
    return True
