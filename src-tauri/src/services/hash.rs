use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const CHUNK_SIZE: u64 = 1024 * 1024;

pub fn head_tail_sha256(path: &Path) -> std::io::Result<(String, String)> {
    let mut file = File::open(path)?;
    let len = file.metadata()?.len();
    if len == 0 {
        let empty = hex(&Sha256::digest(&[]));
        return Ok((empty.clone(), empty));
    }

    let head_len = len.min(CHUNK_SIZE);
    let mut head_buf = vec![0u8; head_len as usize];
    file.read_exact(&mut head_buf)?;
    let head = hex(&Sha256::digest(&head_buf));

    let tail_len = len.min(CHUNK_SIZE) as u64;
    if tail_len == len {
        return Ok((head.clone(), head));
    }
    file.seek(SeekFrom::Start(len - tail_len))?;
    let mut tail_buf = vec![0u8; tail_len as usize];
    file.read_exact(&mut tail_buf)?;
    let tail = hex(&Sha256::digest(&tail_buf));
    Ok((head, tail))
}

fn hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(64);
    for b in bytes {
        out.push_str(&format!("{b:02x}"));
    }
    out
}
