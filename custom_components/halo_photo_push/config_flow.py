import voluptuous as vol
from homeassistant import config_entries

class Flow(config_entries.ConfigFlow, domain="halo_photo_push"):
    VERSION = 1
    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title="Halo photo uploads", data=user_input)
        return self.async_show_form(step_id="user", data_schema=vol.Schema({
            vol.Required("folder_id"): str,
            vol.Required("credential_file"): str,
        }))
