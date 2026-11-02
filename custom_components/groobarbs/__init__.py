"""Private Groobarbs integration with reviewed, serialized box swaps."""
import asyncio
import hashlib
import json
import logging
from datetime import timedelta
import voluptuous as vol
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_track_time_interval
from .client import Client, GroobarbsError
_LOGGER=logging.getLogger(__name__)

def revision(preview):
    return hashlib.sha256(json.dumps(preview,sort_keys=True).encode()).hexdigest()

async def async_setup(hass, config): return True

async def async_setup_entry(hass, entry):
    client=Client(entry.data['email'],entry.data['password']); lock=asyncio.Lock()
    hass.data['groobarbs']={'client':client}
    def publish(p):
        hass.states.async_set('sensor.groobarbs_next_delivery',p['date'] or 'unknown',{'friendly_name':'Groobarbs next delivery',**p,'revision':revision(p),'swaps_enabled':True})
    async def read():
        if not getattr(client,'_signed_in',False):
            await client.login(); client._signed_in=True
        return await client.read()
    async def refresh(_=None):
        async with lock:
            try: publish(await read())
            except Exception:
                client._signed_in=False
                hass.states.async_set('sensor.groobarbs_next_delivery','unavailable')
                _LOGGER.warning('Groobarbs refresh failed; reconnect or check website compatibility')
    async def swap(call):
        async with lock:
            try:
                current=await read()
                if revision(current)!=call.data['revision']:
                    publish(current)
                    raise GroobarbsError('Box changed. Review refreshed contents before saving.')
                result=await client.swap(call.data['order_id'],call.data['item_id'],call.data['content_id'],call.data['replacement_id'],current)
                publish(result)
            except Exception as exc:
                # Reconcile uncertain results, but never repeat a mutation.
                try: publish(await client.read())
                except Exception: client._signed_in=False
                message=str(exc) if isinstance(exc,GroobarbsError) else 'Result uncertain. Refresh and check Groobarbs before trying again.'
                raise HomeAssistantError(message) from None
    schema=vol.Schema({vol.Required(k):vol.All(int,vol.Range(min=1)) for k in ['order_id','item_id','content_id','replacement_id']} | {vol.Required('revision'):str})
    hass.services.async_register('groobarbs','swap',swap,schema=schema)
    hass.services.async_register('groobarbs','refresh',refresh)
    async def stop(_): await client.close()
    entry.async_on_unload(hass.bus.async_listen_once('homeassistant_stop',stop))
    entry.async_on_unload(async_track_time_interval(hass,refresh,timedelta(minutes=30)))
    await refresh()
    return True

async def async_unload_entry(hass,entry):
    hass.services.async_remove('groobarbs','swap');hass.services.async_remove('groobarbs','refresh')
    await hass.data.pop('groobarbs')['client'].close()
    hass.states.async_remove('sensor.groobarbs_next_delivery')
    return True
