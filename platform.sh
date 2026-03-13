#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
TAILSCALE_IP="100.120.34.53"
BACKEND_PORT="8090"
FRONTEND_PORT="5173"
LOG_ROOT="$ROOT_DIR/logs/startup"
LATEST_LINK="$LOG_ROOT/latest"

ACTION="${1:-start}"

if [[ ! -d "$BACKEND_DIR" || ! -d "$FRONTEND_DIR" ]]; then
  echo "Expected backend and frontend directories in: $ROOT_DIR"
  exit 1
fi

usage() {
  echo "Usage: $0 [start|stop|restart|status|docker:up|docker:down|docker:reset|docker:logs]"
}

resolve_pid_file() {
  if [[ -L "$LATEST_LINK" && -f "$LATEST_LINK/pids.txt" ]]; then
    echo "$LATEST_LINK/pids.txt"
    return
  fi

  local latest_dir
  latest_dir="$(ls -1dt "$LOG_ROOT"/* 2>/dev/null | head -n 1 || true)"
  if [[ -n "$latest_dir" && -f "$latest_dir/pids.txt" ]]; then
    echo "$latest_dir/pids.txt"
    return
  fi

  echo ""
}

start_process() {
  local name="$1"
  local workdir="$2"
  local command="$3"
  local log_file="$LOG_DIR/$name.log"

  nohup bash -lc "cd '$workdir' && $command" >"$log_file" 2>&1 &
  local pid=$!
  echo "$name:$pid:$log_file" >>"$PID_FILE"
  echo "Started $name (PID: $pid)"
}

do_start() {
  local timestamp
  local log_dir
  local pid_file
  local bootstrap_log

  timestamp="$(date +"%Y%m%d-%H%M%S")"
  log_dir="$LOG_ROOT/$timestamp"
  pid_file="$log_dir/pids.txt"

  mkdir -p "$log_dir"
  ln -sfn "$log_dir" "$LATEST_LINK"

  LOG_DIR="$log_dir"
  PID_FILE="$pid_file"
  bootstrap_log="$LOG_DIR/bootstrap.log"

  echo "Preparing backend (migrate + tenant migrate + seed)..."
  bash -lc "cd '$BACKEND_DIR' && php artisan migrate --force && php artisan tenants:migrate --force && php artisan db:seed --force" >"$bootstrap_log" 2>&1

  echo "Starting platform services..."

  start_process "backend-server" "$BACKEND_DIR" "php artisan serve --host=0.0.0.0 --port=$BACKEND_PORT"
  start_process "queue-worker" "$BACKEND_DIR" "php artisan queue:work --tries=3"
  start_process "frontend-dev" "$FRONTEND_DIR" "npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT"

  echo
  echo "Startup complete."
  echo "Logs directory: $LOG_DIR"
  echo "PID file: $PID_FILE"
  echo
  echo "Per-service logs:"
  echo "- Backend API: $LOG_DIR/backend-server.log"
  echo "- Queue Worker: $LOG_DIR/queue-worker.log"
  echo "- Frontend Dev: $LOG_DIR/frontend-dev.log"
  echo "- Bootstrap (migrate/seed): $LOG_DIR/bootstrap.log"
  echo
  echo "Access URLs:"
  echo "- Local frontend: http://127.0.0.1:$FRONTEND_PORT"
  echo "- Tailscale frontend: http://$TAILSCALE_IP:$FRONTEND_PORT"
  echo "- Local API: http://127.0.0.1:$BACKEND_PORT"
  echo "- Tailscale API: http://$TAILSCALE_IP:$BACKEND_PORT"
}

do_stop() {
  local pid_file
  pid_file="$(resolve_pid_file)"

  if [[ -z "$pid_file" ]]; then
    echo "No PID file found. Nothing to stop."
    exit 0
  fi

  local stopped=0
  while IFS=: read -r name pid logfile; do
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo "Stopped $name (PID: $pid)"
      stopped=1
    else
      echo "$name already stopped or PID missing ($pid)"
    fi
  done < "$pid_file"

  if [[ "$stopped" -eq 0 ]]; then
    echo "No running services found in: $pid_file"
  fi
}

do_status() {
  local pid_file
  pid_file="$(resolve_pid_file)"

  if [[ -z "$pid_file" ]]; then
    echo "No PID file found."
    exit 0
  fi

  echo "Using PID file: $pid_file"
  while IFS=: read -r name pid logfile; do
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "$name: running (PID $pid)"
    else
      echo "$name: stopped"
    fi
    echo "  log: $logfile"
  done < "$pid_file"
}

do_docker_up() {
  cd "$ROOT_DIR"
  docker compose up --build -d
}

do_docker_down() {
  cd "$ROOT_DIR"
  docker compose stop
}

do_docker_reset() {
  cd "$ROOT_DIR"
  docker compose down
}

do_docker_logs() {
  cd "$ROOT_DIR"
  docker compose logs -f
}

case "$ACTION" in
  start)
    do_start
    ;;
  stop)
    do_stop
    ;;
  restart)
    do_stop
    do_start
    ;;
  status)
    do_status
    ;;
  docker:up)
    do_docker_up
    ;;
  docker:down)
    do_docker_down
    ;;
  docker:reset)
    do_docker_reset
    ;;
  docker:logs)
    do_docker_logs
    ;;
  *)
    usage
    exit 1
    ;;
esac
