#!/usr/bin/env python3
"""
PerintahX v1 - Autonomous WordPress Monitoring & Recovery System
Mode: OBSERVE_ONLY by default (no destructive actions)
"""
import json
import os
import socket
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import psutil
import requests
import yaml


# -----------------------------
# Utilities
# -----------------------------
def utc_now_iso() -> str:
    """Return current UTC timestamp in ISO format"""
    return datetime.now(timezone.utc).isoformat()


def safe_get(d: Dict[str, Any], path: str, default=None):
    """Safely navigate nested dict with dot notation (e.g., 'database.host')"""
    cur = d
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur


# -----------------------------
# Audit Logger (JSONL)
# -----------------------------
class AuditLogger:
    """Immutable audit log in JSONL format for full traceability"""

    def __init__(self, path: str = "audit.log.jsonl"):
        self.path = path

    def record(self, trigger: str, action: str, result: str, verification: Optional[Dict[str, Any]] = None):
        """Record event to audit log"""
        event = {
            "timestamp": utc_now_iso(),
            "trigger": trigger,
            "action": action,
            "result": result,
            "verification": verification or {},
        }
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")


# -----------------------------
# Security Guard (whitelist only)
# -----------------------------
class SecurityGuard:
    """Enforce whitelist-only command execution for security"""

    def __init__(self, whitelist):
        self.whitelist = set(whitelist or [])

    def assert_allowed(self, cmd: str) -> bool:
        """Check if command is in whitelist"""
        return cmd in self.whitelist


class CommandExecutor:
    """Execute system commands with security guard and audit logging"""

    def __init__(self, guard: SecurityGuard, logger: AuditLogger, mode: str):
        self.guard = guard
        self.logger = logger
        self.mode = mode

    def run(self, trigger: str, cmd: str) -> Tuple[bool, str]:
        """Execute command with safety checks"""
        # FAIL_SAFE: do not execute if not explicitly allowed
        if not self.guard.assert_allowed(cmd):
            self.logger.record(trigger, f"EXECUTE_CMD:{cmd}", "DENIED_NOT_WHITELISTED", {})
            return False, "Denied: command not whitelisted"

        # Observe-only mode: do not execute
        if self.mode != "ACTIVE":
            self.logger.record(trigger, f"EXECUTE_CMD:{cmd}", "SKIPPED_OBSERVE_ONLY", {})
            return True, "Skipped (OBSERVE_ONLY)"

        try:
            completed = subprocess.run(
                cmd.split(" "),
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            ok = completed.returncode == 0
            self.logger.record(
                trigger,
                f"EXECUTE_CMD:{cmd}",
                "OK" if ok else "FAILED",
                {"returncode": completed.returncode, "stdout": completed.stdout[-2000:], "stderr": completed.stderr[-2000:]},
            )
            return ok, completed.stdout.strip() if ok else completed.stderr.strip()
        except Exception as e:
            # FAIL_SAFE: on uncertainty, do not proceed with further actions
            self.logger.record(trigger, f"EXECUTE_CMD:{cmd}", "ERROR_EXCEPTION", {"error": str(e)})
            return False, f"Exception: {e}"


# -----------------------------
# Checks
# -----------------------------
@dataclass
class CheckResult:
    """Result of a health check"""
    ok: bool
    detail: Dict[str, Any]


def check_http_200(url: str, timeout: int = 5) -> CheckResult:
    """Check if HTTP endpoint returns 2xx status"""
    try:
        r = requests.get(url, timeout=timeout, headers={"User-Agent": "perintahx-monitor/1.0"})
        return CheckResult(ok=(200 <= r.status_code < 300), detail={"status_code": r.status_code})
    except Exception as e:
        return CheckResult(ok=False, detail={"error": str(e)})


def check_disk_usage_percent(path: str = "/") -> CheckResult:
    """Check disk usage percentage"""
    usage = psutil.disk_usage(path)
    percent = float(usage.percent)
    return CheckResult(ok=True, detail={"percent": percent, "free_gb": round(usage.free / (1024**3), 2)})


def check_db_tcp(host: str, port: int, timeout_seconds: int = 2) -> CheckResult:
    """Safe minimal check: can we open TCP socket to database?"""
    try:
        with socket.create_connection((host, port), timeout=timeout_seconds):
            return CheckResult(ok=True, detail={"tcp_connect": "OK"})
    except Exception as e:
        return CheckResult(ok=False, detail={"tcp_connect": "FAILED", "error": str(e)})


def check_traffic_metrics_stub() -> CheckResult:
    """Placeholder traffic metrics check (extend to GA/Search Console later)"""
    # In v1 we don't pull GA/SC. Treat as OK with unknown baseline.
    return CheckResult(ok=True, detail={"traffic_drop_percent": 0})


def check_publishing_queue_stub(publishing_enabled: bool, article_status: str) -> CheckResult:
    """Check if publishing queue has ready articles"""
    # In v1: we just model a simple status flag in config
    ready = publishing_enabled and (article_status.upper() == "READY")
    return CheckResult(ok=True, detail={"publish_queue": "READY" if ready else "NOT_READY"})


# -----------------------------
# Decision Engine + Actions
# -----------------------------
class PerintahX:
    """Main autonomous monitoring and recovery system"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.mode = config.get("mode", "OBSERVE_ONLY")
        self.logger = AuditLogger()
        self.guard = SecurityGuard(safe_get(config, "security.whitelist_commands", []))
        self.exec = CommandExecutor(self.guard, self.logger, self.mode)

        self.interval = int(config.get("interval_seconds", 60))
        self.kill_switch_file = config.get("kill_switch_file", "./KILL_SWITCH")

    def system_start(self):
        """Initialize system and log startup"""
        self.logger.record("SYSTEM_START", "load_config", "OK", {"mode": self.mode})
        self.logger.record("SYSTEM_START", "load_whitelist_commands", "OK", {"count": len(self.guard.whitelist)})
        self.logger.record("SYSTEM_START", "verify_credentials", "SKIPPED_V1", {})
        self.logger.record("SYSTEM_START", "set_mode", "OK", {"mode": self.mode})
        self.logger.record("SYSTEM_START", "start_monitoring", "OK", {"interval_seconds": self.interval})
        print(f"[{utc_now_iso()}] PerintahX v1 started in {self.mode} mode")

    def kill_switch_triggered(self) -> bool:
        """Check if emergency kill switch file exists"""
        return os.path.exists(self.kill_switch_file)

    def admin_alert(self, trigger: str, message: str, context: Dict[str, Any]):
        """Send alert to admin (v1: log-only, replace with email/slack/webhook)"""
        self.logger.record(trigger, "ADMIN_ALERT", message, context)
        print(f"[{utc_now_iso()}] ADMIN_ALERT [{trigger}] {message}: {context}")

    def monitor_once(self):
        """Run one monitoring cycle"""
        # MONITORING LOOP (CORE)
        site_url = safe_get(self.config, "endpoints.site_url", "")
        wp_api = safe_get(self.config, "endpoints.wp_api_health", "")
        http_check_url = safe_get(self.config, "endpoints.http_check_url", site_url)

        thresholds = self.config.get("thresholds", {})
        disk_warn = float(thresholds.get("disk_usage_percent_warn", 85))
        disk_target = float(thresholds.get("disk_usage_percent_target", 75))

        db_enabled = bool(safe_get(self.config, "database.enabled", False))
        db_host = safe_get(self.config, "database.host", "127.0.0.1")
        db_port = int(safe_get(self.config, "database.port", 3306))
        db_timeout = int(safe_get(self.config, "database.connect_timeout_seconds", 2))

        publishing_enabled = bool(safe_get(self.config, "publishing.enabled", False))
        article_status = safe_get(self.config, "publishing.article_status", "NOT_READY")

        # Checks
        server_health = check_http_200(http_check_url)
        wordpress_api = check_http_200(wp_api)
        disk_usage = check_disk_usage_percent("/")
        traffic = check_traffic_metrics_stub()
        publish_queue = check_publishing_queue_stub(publishing_enabled, article_status)

        if db_enabled:
            database_status = check_db_tcp(db_host, db_port, db_timeout)
        else:
            database_status = CheckResult(ok=True, detail={"skipped": True})

        snapshot = {
            "server_health": server_health.detail,
            "wordpress_api": wordpress_api.detail,
            "database_status": database_status.detail,
            "disk_usage": disk_usage.detail,
            "traffic_metrics": traffic.detail,
            "publishing_queue": publish_queue.detail,
        }
        self.logger.record("MONITOR_LOOP", "CHECKS_SNAPSHOT", "OK", snapshot)
        print(f"[{utc_now_iso()}] Health check: server={server_health.ok}, wp={wordpress_api.ok}, db={database_status.ok}, disk={disk_usage.detail.get('percent')}%")

        # DECISION ENGINE
        # Fail-safe: if kill switch present, halt actions
        if self.kill_switch_triggered():
            self.logger.record("KILL_SWITCH", "stop_all_actions", "TRIGGERED", {"file": self.kill_switch_file})
            print(f"[{utc_now_iso()}] KILL SWITCH TRIGGERED - all actions halted")
            return

        # server recovery
        if not server_health.ok:
            self.server_recovery()
            return

        # wp recovery
        if not wordpress_api.ok:
            self.wp_recovery()
            return

        # db recovery
        if db_enabled and not database_status.ok:
            self.db_recovery()
            return

        # disk cleanup
        disk_percent = float(disk_usage.detail.get("percent", 0))
        if disk_percent > disk_warn:
            self.disk_cleanup(disk_target)
            return

        # traffic diagnosis (stub: only if traffic_drop > threshold)
        traffic_drop = float(traffic.detail.get("traffic_drop_percent", 0))
        if traffic_drop > float(thresholds.get("traffic_drop_percent", 50)):
            self.seo_diagnosis()
            return

        # auto publish (only if enabled and stable)
        system_health_stable = server_health.ok and wordpress_api.ok and (database_status.ok if db_enabled else True)
        if publish_queue.detail.get("publish_queue") == "READY" and system_health_stable:
            self.auto_publish()
            return

        self.logger.record("DECISION_ENGINE", "NO_ACTION", "STABLE_NO_TRIGGER", {"system_health_stable": system_health_stable})

    # -----------------------------
    # Actions
    # -----------------------------
    def server_recovery(self):
        """Recover server by restarting web services"""
        trigger = "SERVER_RECOVERY"
        self.logger.record(trigger, "start", "RUN", {})
        print(f"[{utc_now_iso()}] {trigger} initiated")

        # action
        self.exec.run(trigger, "systemctl restart nginx")
        self.exec.run(trigger, "systemctl restart php8.2-fpm")

        # verify
        url = safe_get(self.config, "endpoints.http_check_url", safe_get(self.config, "endpoints.site_url", ""))
        time.sleep(2)  # give services time to restart
        verify = check_http_200(url)
        if not verify.ok:
            self.admin_alert(trigger, "VERIFY_FAIL", {"verify": verify.detail})
        self.logger.record(trigger, "SERVER_RECOVERY_RESULT", "OK" if verify.ok else "FAILED", {"verify": verify.detail})

    def wp_recovery(self):
        """Recover WordPress by clearing cache and checking health"""
        trigger = "WP_RECOVERY"
        self.logger.record(trigger, "start", "RUN", {})
        print(f"[{utc_now_iso()}] {trigger} initiated")

        # v1 safe approach: we do NOT disable plugins automatically (risky).
        # Instead we only clear cache via placeholder command (add to whitelist if you implement).
        self.logger.record(trigger, "disable_non_core_plugins", "SKIPPED_V1_SAFETY", {})
        self.logger.record(trigger, "clear_cache", "SKIPPED_V1", {})

        # retry
        wp_api = safe_get(self.config, "endpoints.wp_api_health", "")
        time.sleep(2)
        retry = check_http_200(wp_api)
        if not retry.ok:
            self.admin_alert(trigger, "RETRY_FAIL", {"retry": retry.detail})
        self.logger.record(trigger, "WP_RECOVERY_RESULT", "OK" if retry.ok else "FAILED", {"retry": retry.detail})

    def db_recovery(self):
        """Recover database by restarting service"""
        trigger = "DB_RECOVERY"
        self.logger.record(trigger, "start", "RUN", {})
        print(f"[{utc_now_iso()}] {trigger} initiated")

        # action
        self.exec.run(trigger, "systemctl restart mysql")
        self.logger.record(trigger, "integrity_check_safe", "SKIPPED_V1", {})

        # verify (tcp connect)
        host = safe_get(self.config, "database.host", "127.0.0.1")
        port = int(safe_get(self.config, "database.port", 3306))
        timeout = int(safe_get(self.config, "database.connect_timeout_seconds", 2))
        time.sleep(3)  # give db time to restart
        verify = check_db_tcp(host, port, timeout)

        if not verify.ok:
            self.admin_alert(trigger, "VERIFY_FAIL", {"verify": verify.detail})
        self.logger.record(trigger, "DB_RECOVERY_RESULT", "OK" if verify.ok else "FAILED", {"verify": verify.detail})

    def disk_cleanup(self, target_percent: float):
        """Clean up disk space to reach target usage percentage"""
        trigger = "DISK_CLEANUP"
        self.logger.record(trigger, "start", "RUN", {"target_percent": target_percent})
        print(f"[{utc_now_iso()}] {trigger} initiated (target: {target_percent}%)")

        # actions (conservative)
        self.exec.run(trigger, "logrotate -f /etc/logrotate.conf")
        # You can add cache/temp cleanup commands to whitelist later.

        # verify
        time.sleep(1)
        usage = check_disk_usage_percent("/")
        ok = float(usage.detail.get("percent", 100)) < target_percent
        self.logger.record(trigger, "DISK_CLEANUP_RESULT", "OK" if ok else "FAILED", {"disk_usage": usage.detail})

    def seo_diagnosis(self):
        """Diagnose SEO issues (traffic drops, indexing problems)"""
        trigger = "SEO_DIAGNOSIS"
        print(f"[{utc_now_iso()}] {trigger} initiated")

        self.logger.record(trigger, "read_only_check:google_analytics", "SKIPPED_V1", {})
        self.logger.record(trigger, "read_only_check:search_console", "SKIPPED_V1", {})

        # actions (safe)
        self.logger.record(trigger, "validate_sitemap", "TODO", {})
        self.logger.record(trigger, "ping_google", "TODO", {})

        self.logger.record(trigger, "SEO_DIAGNOSIS_RESULT", "DONE_V1", {})

    def auto_publish(self):
        """Automatically publish ready articles to WordPress"""
        trigger = "AUTO_PUBLISH"
        print(f"[{utc_now_iso()}] {trigger} initiated")

        self.logger.record(trigger, "precheck", "OK", {"system_health": "STABLE", "article_status": "READY"})

        # v1: publishing is potentially destructive, so keep it off by default.
        if self.mode != "ACTIVE":
            self.logger.record(trigger, "publish_article", "SKIPPED_OBSERVE_ONLY", {})
            return

        # In ACTIVE mode, implement actual publishing
        wp_posts_endpoint = safe_get(self.config, "publishing.wp_posts_endpoint", "")
        wp_username = safe_get(self.config, "publishing.wp_username", "")
        wp_app_password = safe_get(self.config, "publishing.wp_app_password", "")

        if not all([wp_posts_endpoint, wp_username, wp_app_password]):
            self.logger.record(trigger, "publish_article", "FAILED_MISSING_CREDENTIALS", {})
            return

        # Example publish logic (extend as needed)
        try:
            # This is a placeholder - implement actual article fetching and publishing
            post_data = {
                "title": "Auto-generated post",
                "content": "Content from autonomous system",
                "status": "draft",  # Safe default
            }

            response = requests.post(
                wp_posts_endpoint,
                json=post_data,
                auth=(wp_username, wp_app_password),
                timeout=10,
            )

            ok = response.status_code in (200, 201)
            self.logger.record(
                trigger,
                "publish_article",
                "OK" if ok else "FAILED",
                {"status_code": response.status_code, "response": response.text[:500]},
            )
        except Exception as e:
            self.logger.record(trigger, "publish_article", "ERROR_EXCEPTION", {"error": str(e)})

    def run(self):
        """Main monitoring loop"""
        self.system_start()

        try:
            while True:
                self.monitor_once()
                time.sleep(self.interval)
        except KeyboardInterrupt:
            print(f"\n[{utc_now_iso()}] Shutting down gracefully...")
            self.logger.record("SYSTEM_STOP", "user_interrupt", "OK", {})


def main():
    """Entry point"""
    config_path = os.getenv("PERINTAHX_CONFIG", "config.yaml")

    if not os.path.exists(config_path):
        print(f"Error: Config file not found: {config_path}")
        print("Please create config.yaml or set PERINTAHX_CONFIG environment variable")
        return 1

    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    system = PerintahX(config)
    system.run()

    return 0


if __name__ == "__main__":
    exit(main())
