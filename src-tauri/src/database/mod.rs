use crate::error::AppError;
use chrono::Local;
use rusqlite::Connection;
use std::path::Path;

pub const MIGRATIONS: &[&str] = &[
    // v1: core schema
    r#"
    CREATE TABLE IF NOT EXISTS project (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        template_type TEXT NOT NULL DEFAULT 'blank',
        source_mode TEXT NOT NULL DEFAULT 'referenced',
        source_video_path TEXT NOT NULL,
        portable_video_path TEXT,
        sort_mode TEXT NOT NULL DEFAULT 'video_time',
        sort_direction TEXT NOT NULL DEFAULT 'asc',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT
    );

    CREATE TABLE IF NOT EXISTS video_meta (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        duration_ms INTEGER,
        width INTEGER,
        height INTEGER,
        frame_rate REAL,
        codec TEXT,
        container_format TEXT,
        rotation INTEGER DEFAULT 0,
        hash_head TEXT,
        hash_tail TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES project(id)
    );

    CREATE TABLE IF NOT EXISTS review_record (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT,
        description TEXT,
        category TEXT,
        importance TEXT,
        time_mode TEXT NOT NULL DEFAULT 'point',
        start_time_ms INTEGER NOT NULL,
        end_time_ms INTEGER NOT NULL,
        representative_time_ms INTEGER NOT NULL,
        has_screenshot INTEGER NOT NULL DEFAULT 1,
        source_image_path TEXT,
        thumbnail_path TEXT,
        thumbnail_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES project(id)
    );

    CREATE TABLE IF NOT EXISTS annotation (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        type TEXT NOT NULL,
        z_index INTEGER NOT NULL DEFAULT 0,
        style_json TEXT NOT NULL,
        geometry_json TEXT NOT NULL,
        content TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(record_id) REFERENCES review_record(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_video_meta_project ON video_meta(project_id);
    CREATE INDEX IF NOT EXISTS idx_review_record_project ON review_record(project_id);
    CREATE INDEX IF NOT EXISTS idx_review_record_time ON review_record(project_id, start_time_ms);
    CREATE INDEX IF NOT EXISTS idx_annotation_record ON annotation(record_id);
    "#,
];

fn now() -> String {
    Local::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, false)
}

fn migrate(conn: &mut Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;

    let mut applied: Vec<i64> = Vec::new();
    {
        let mut stmt = conn.prepare("SELECT version FROM schema_migrations ORDER BY version")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        for row in rows {
            applied.push(row?);
        }
    }

    let tx = conn.transaction()?;
    for (index, sql) in MIGRATIONS.iter().enumerate() {
        let version = (index + 1) as i64;
        if !applied.contains(&version) {
            tx.execute_batch(sql)?;
            tx.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
                rusqlite::params![version, now()],
            )?;
        }
    }
    tx.commit()
}

pub fn open(project_dir: &Path) -> Result<Connection, AppError> {
    let path = project_dir.join("project.db");
    let mut conn = Connection::open(&path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "busy_timeout", "5000")?;
    migrate(&mut conn)?;
    Ok(conn)
}

pub fn now_iso() -> String {
    now()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn migration_creates_schema_and_is_idempotent() {
        let dir =
            std::env::temp_dir().join(format!("vrs-db-test-{}", uuid::Uuid::new_v4().simple()));
        fs::create_dir_all(&dir).unwrap();
        let mut conn = Connection::open(dir.join("project.db")).unwrap();
        migrate(&mut conn).unwrap();
        migrate(&mut conn).unwrap();

        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(tables.contains(&"project".to_string()));
        assert!(tables.contains(&"video_meta".to_string()));
        assert!(tables.contains(&"review_record".to_string()));
        assert!(tables.contains(&"annotation".to_string()));
        assert!(tables.contains(&"schema_migrations".to_string()));

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, MIGRATIONS.len() as i64);
        let _ = fs::remove_dir_all(&dir);
    }
}
