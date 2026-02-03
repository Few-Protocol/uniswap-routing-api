#!/usr/bin/env python3
import argparse
import sys
import subprocess
import os
import time
from datetime import datetime, timedelta

# # 使用 tbbeta (默认)
# python3 pullroutingapilog.py -id abc123

# # 使用 ringprod
# python3 pullroutingapilog.py -id abc123 --profile ringprod

# # 回溯更长时间
# python3 pullroutingapilog.py -id abc123 --profile ringprod --hours 48

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

TBBETA_LOG_GROUP = ["/aws/lambda/RoutingAPIStack-RoutingLamb-RoutingLambda2C4DF0900-sB9DHepdxamz"]
RINGPROD_LOG_GROUP = ["/aws/lambda/RoutingAPIStack-RoutingLamb-RoutingLambda2C4DF0900-1ncIZdVcoakJ"]

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
    parser = argparse.ArgumentParser(
        description="拉取RoutingAPI Lambda日志，支持 -id 模糊匹配",
        epilog="""
示例:
  %(prog)s -id abc123                    # 使用 tbbeta (默认)
  %(prog)s -id abc123 --profile ringprod # 使用 ringprod
  %(prog)s -id abc123 --hours 48         # 回溯 48 小时
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("-id", "--id", required=True, help="模糊匹配关键词（如请求ID片段）")
    parser.add_argument("--hours", type=int, default=24, help="回溯小时数，默认24小时")
    parser.add_argument("--limit", type=int, default=1000, help="最多获取日志条数，默认1000")
    parser.add_argument("--profile", default="tbbeta", choices=["tbbeta", "ringprod"],
                        help="AWS CLI profile 名称 (默认: tbbeta)")
    parser.add_argument("--region", help="AWS 区域", default="us-east-1")
    args = parser.parse_args()

    # 根据 profile 选择对应的 log group
    log_groups = {
        "tbbeta": TBBETA_LOG_GROUP,
        "ringprod": RINGPROD_LOG_GROUP,
    }
    LOG_GROUP = log_groups.get(args.profile, TBBETA_LOG_GROUP)

    session_kwargs = {
        "profile_name": args.profile,
        "region_name": args.region,
    }
    session = boto3.Session(**session_kwargs)

    sts = session.client("sts")
    identity = sts.get_caller_identity()
    print("🚀 RoutingAPI 日志拉取")
    print("==============================================")
    print(f"Profile: {args.profile}")
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

    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(script_dir, f"{args.id}.log")
    lines = [fmt_event(e, i) for i, e in enumerate(all_evts, 1)]
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"✅ 获取到 {len(all_evts)} 条匹配日志\n\n")
        f.writelines(lines)
        f.write(f"\n📈 总计: {len(all_evts)} 条\n")
    print(f"✅ 获取到 {len(all_evts)} 条匹配日志，已保存到 {out_path}")

if __name__ == "__main__":
    main()
