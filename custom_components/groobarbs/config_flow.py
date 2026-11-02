"""Private credential entry through the Home Assistant integration dialog."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import selector
from .client import Client

class Flow(config_entries.ConfigFlow, domain='groobarbs'):
    VERSION=1
    async def async_step_user(self, user_input=None):
        errors={}
        if self._async_current_entries(): return self.async_abort(reason='single_instance_allowed')
        if user_input is not None:
            client=Client(user_input['email'],user_input['password'])
            try:
                await client.login()
                await client.read()
            except Exception:
                errors['base']='cannot_connect'
            else:
                return self.async_create_entry(title='Groobarbs',data=user_input)
            finally:
                await client.close()
        return self.async_show_form(step_id='user',data_schema=vol.Schema({
            vol.Required('email'):str,
            vol.Required('password'):selector.TextSelector(selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD))
        }),errors=errors)
