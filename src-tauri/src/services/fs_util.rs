use regex::Regex;
use std::path::{Component, Path, PathBuf};

pub fn sanitize_file_name(name: &str) -> String {
    let invalid = Regex::new(r#"[<>:"/\\|?*\x00-\x1F]"#).unwrap();
    let mut out = invalid.replace_all(name.trim(), "_").to_string();
    out = out.trim_end_matches(['.', ' ']).to_string();
    if out.is_empty() {
        out = "untitled".to_string();
    }
    out
}

pub fn safe_join_under(root: &Path, rel: &str) -> Option<PathBuf> {
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return None;
    }
    let mut out = root.to_path_buf();
    for comp in rel_path.components() {
        match comp {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return None,
        }
    }
    Some(out)
}

pub fn file_size(path: &Path) -> Option<i64> {
    path.metadata().ok().map(|m| m.len() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_replaces_invalid_chars() {
        assert_eq!(
            sanitize_file_name(r#"a<b>c:d"e/f\g|h?i*j"#),
            "a_b_c_d_e_f_g_h_i_j"
        );
    }

    #[test]
    fn sanitize_trims_dots_and_spaces() {
        assert_eq!(sanitize_file_name(" 标题. "), "标题");
        assert_eq!(sanitize_file_name(""), "untitled");
    }

    #[test]
    fn safe_join_rejects_traversal() {
        let root = Path::new("C:\\projects\\demo");
        assert!(safe_join_under(root, "a/b/c.png").is_some());
        assert!(safe_join_under(root, "../escape.png").is_none());
        assert!(safe_join_under(root, "C:\\abs.png").is_none());
        assert!(safe_join_under(root, "a/../../escape.png").is_none());
    }
}
