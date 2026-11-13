"""Synthetic credentials only; no camera or network is contacted."""
import sys
from pathlib import Path
from dataclasses import replace
import unittest

sys.path.append(str(Path(__file__).resolve().parents[1] / 'custom_components/vtech_baby'))
from vtech_lan.provision import Credentials, derive_authkey
from vtech_lan.profile import KEY_AUTH, RM7767_DTLS, select_credentials
from vtech_lan.session import LinkSession
from vtech_lan.errors import UnsupportedTransport, AuthFailed


class NativeError(Exception):
    def __init__(self, kind, detail, code):
        self.kind, self.detail, self.code = kind, detail, code


class Module:
    LinkError = NativeError
    def __init__(self, reason):
        self.calls = []
        self.reason = reason
    def connect(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        raise self.reason


class Profiles(unittest.TestCase):
    def setUp(self):
        self.creds = Credentials(uid='TESTUID0000000000001', av_password='SyntheticPassword',
            authkey=derive_authkey('SyntheticPassword'), name='VTECH_7767_test')

    def test_standard_remains_default(self):
        self.assertIs(select_credentials(self.creds), self.creds)

    def test_explicit_profile_changes_only_transport_key(self):
        selected = select_credentials(self.creds, RM7767_DTLS)
        self.assertEqual(selected.authkey, '00000000')
        self.assertEqual(replace(selected, authkey=self.creds.authkey), self.creds)
        self.assertNotEqual(selected.authkey, self.creds.authkey)

    def test_no_implicit_or_unknown_profiles(self):
        for profile in ('auto', '', None, 'plaintext'):
            with self.subTest(profile=profile), self.assertRaises(ValueError):
                select_credentials(self.creds, profile)

    def test_wrong_model_rejected(self):
        with self.assertRaises(ValueError):
            select_credentials(replace(self.creds, name='VTECH_5754_test'), RM7767_DTLS)

    def test_password_and_account_required(self):
        for fields in ({'av_password': ''}, {'account': ''}):
            with self.assertRaises(ValueError):
                select_credentials(replace(self.creds, **fields), RM7767_DTLS)

    def test_native_connect_gets_new_request_and_original_password(self):
        for profile in (KEY_AUTH, RM7767_DTLS):
            c = select_credentials(self.creds, profile)
            m = Module(NativeError('iotc_rejected', 'no_key_auth:camera_result_6', -69))
            s = LinkSession(m, c.uid, c.authkey, c.av_password, c.account)
            with self.assertRaises(UnsupportedTransport):
                s._open()
            self.assertEqual(len(m.calls), 1, 'must not retry with weaker authentication')
            args, kw = m.calls[0]
            self.assertEqual(args, (c.uid, c.authkey, self.creds.av_password, self.creds.account))
            self.assertNotIn('security_mode', kw)

    def test_dtls_rejection_stops_without_fallback(self):
        c = select_credentials(self.creds, RM7767_DTLS)
        m = Module(NativeError('av_auth_failed', 'dtls_alert:51', -20009))
        s = LinkSession(m, c.uid, c.authkey, c.av_password, c.account)
        with self.assertRaises(AuthFailed):
            s._open()
        self.assertEqual(len(m.calls), 1)
        self.assertIsNone(s.link)

if __name__ == '__main__':
    unittest.main()
