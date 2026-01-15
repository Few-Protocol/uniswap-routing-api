#!/usr/bin/env python3
import argparse
import sys
import subprocess
import os
import time
from datetime import datetime, timedelta

def _install_boto3():
    cmds = [
        [sys.executable, "-m", "pip", "install", "boto3"],
        ["pip3", "install", "boto3"],
        ["pip", "install", "boto3"],
    ]
    for cmd in cmds:
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception:
            pass
    return False

def _setup_venv_and_reexec():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    venv_dir = os.path.join(script_dir, ".venv_routingapi")
    venv_python = os.path.join(venv_dir, "bin", "python")
    if not os.path.exists(venv_python):
        subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
    subprocess.run([venv_python, "-m", "pip", "install", "boto3"], check=True)
    os.execv(venv_python, [venv_python, os.path.abspath(__file__)] + sys.argv[1:])

try:
    import boto3
except ImportError:
    print("安装依赖 boto3 ...")
    ok = _install_boto3()
    if not ok:
        print("当前环境受管，使用本地虚拟环境安装依赖")
        _setup_venv_and_reexec()
    import boto3

LOG_GROUP = ["UnifiedRoutingStack-UnifiedRoutingAPIGAccessLogsF444275D-R8LbRvrwKbUB",
"/aws/lambda/UnifiedRoutingStack-QuoteE2906A56-r6220qogMILP",
"/aws/lambda/UnifiedRoutingStack-LogRetentionaae0aa3c5b4d4f87b0-s6ZeYbAD7fXn"]

def fmt_event(e, i):
    ts = e.get("timestamp", 0)
    tstr = datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] if ts else "Unknown"
    stream = e.get("logStreamName", "Unknown")
    msg = e.get("message", "").strip()
    return f"[{i}] {tstr} | {stream}\n   {msg}\n"

def fetch_logs(session, log_group, keyword, hours_back, limit):
    logs = session.client("logs")
    end_time = int(time.time() * 1000)
    start_time = int((datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000)
    events = []
    next_token = None
    count = 0
    while True:
        kwargs = {
            "logGroupName": log_group,
            "startTime": start_time,
            "endTime": end_time,
            "filterPattern": keyword,
            "limit": min(100, limit - count)
        }
        if next_token:
            kwargs["nextToken"] = next_token
        resp = logs.filter_log_events(**kwargs)
        batch = resp.get("events", [])
        events.extend(batch)
        count += len(batch)
        next_token = resp.get("nextToken")
        if not next_token or count >= limit:
            break
    events.sort(key=lambda x: x.get("timestamp", 0))
    return events

def main():
    parser = argparse.ArgumentParser(description="拉取RoutingAPI Lambda日志，支持 -id 模糊匹配")
    parser.add_argument("-id", "--id", required=True, help="模糊匹配关键词（如请求ID片段）")
    parser.add_argument("--hours", type=int, default=24, help="回溯小时数，默认24小时")
    parser.add_argument("--limit", type=int, default=1000, help="最多获取日志条数，默认1000")
    parser.add_argument("--profile", help="AWS CLI profile 名称")
    parser.add_argument("--region", help="AWS 区域", default="us-east-1")
    args = parser.parse_args()

    session_kwargs = {}
    if args.profile:
        session_kwargs["profile_name"] = args.profile
    else:
        session_kwargs["profile_name"] = "tbbeta"
    if args.region:
        session_kwargs["region_name"] = args.region
    session = boto3.Session(**session_kwargs)

    sts = session.client("sts")
    identity = sts.get_caller_identity()
    print("🚀 RoutingAPI 日志拉取")
    print("==============================================")
    print(f"账户ID: {identity['Account']}")
    print(f"用户ARN: {identity['Arn']}")
    print(f"区域: {session.region_name}")
    print(f"日志组: {LOG_GROUP}")
    print(f"过滤模式 (FilterPattern): {args.id}")
    print(f"时间范围: 最近 {args.hours} 小时")
    print("==============================================\n")

    all_evts = []
    groups = LOG_GROUP if isinstance(LOG_GROUP, list) else [LOG_GROUP]

    for group in groups:
        try:
            evts = fetch_logs(session, group, args.id, args.hours, args.limit)
            all_evts.extend(evts)
        except session.client("logs").exceptions.ResourceNotFoundException:
            print(f"⚠️ 日志组 {group} 不存在或不可访问")
        except Exception as e:
            print(f"❌ 拉取日志组 {group} 失败: {e}")

    if not all_evts:
        print("⚠️ 未找到匹配日志")
        return

    all_evts.sort(key=lambda x: x.get("timestamp", 0))

    print(f"✅ 获取到 {len(all_evts)} 条匹配日志\n")
    for i, e in enumerate(all_evts, 1):
        print(fmt_event(e, i))
    print(f"📈 总计: {len(all_evts)} 条")

if __name__ == "__main__":
    main()
