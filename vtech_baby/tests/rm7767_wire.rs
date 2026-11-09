//! Candidate profile wire regression. Synthetic; does not establish firmware compatibility.
use std::net::{Ipv4Addr, SocketAddrV4};
use std::time::{Duration, Instant};
use vtech_link_core::iotc::{IotcConfig, IotcEvent, IotcSession};
use vtech_link_core::iotc::{codec, scramble::unscramble};

#[test]
fn legacy_candidate_changes_probe_but_does_not_accept_rejection() {
    let token = [1,2,3,4,5,6,7,8];
    let mut session = IotcSession::new(IotcConfig::default(), "TESTUID0000000000001", b"00000000", token).unwrap();
    let now = Instant::now();
    session.connect(now, now + Duration::from_secs(2), &[Ipv4Addr::new(192,168,1,255)]);
    let packets: Vec<_> = std::iter::from_fn(|| session.poll_transmit()).collect();
    let mut probe = packets.iter().find(|p| p.data.len() == codec::PROBE_LEN).unwrap().data.clone();
    unscramble(&mut probe, usize::MAX);
    assert_eq!(&probe[0x4a..0x52], b"00000000");
    assert!(!probe.windows(17).any(|w| w == b"SyntheticPassword"));
    let mut rejection = vec![0u8; 200];
    rejection[0..2].copy_from_slice(&codec::MAGIC.to_le_bytes());
    rejection[2] = 27;
    rejection[4..6].copy_from_slice(&184u16.to_le_bytes());
    rejection[8..10].copy_from_slice(&codec::OP_LAN_REPLY.to_le_bytes());
    rejection[0xbc..0xc4].copy_from_slice(&token);
    rejection[0xc4] = 6;
    codec::seal(&mut rejection);
    session.handle_datagram(now, SocketAddrV4::new(Ipv4Addr::new(192,168,1,220),32762), &mut rejection);
    assert!(matches!(session.poll_event(), Some(IotcEvent::Ended(_))));
    assert!(session.poll_transmit().is_none());
}
