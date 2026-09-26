#!/usr/bin/env python3
"""
在目标服务器上执行一个本地 shell 脚本，并取回输出。

走腾讯云 TAT（自动化助手），用 tencent-cloud-ops 的 imalltrix 运维 profile。
运维凭证只在本机使用，不会上服务器。

用法：
    python3 deploy/remote.py deploy/steps/00-baseline.sh
    python3 deploy/remote.py deploy/steps/01-dirs.sh --root      # 需要 root 时
    python3 deploy/remote.py --invocation inv-xxxx               # 只读既有结果
"""
import argparse, base64, json, subprocess, sys, tempfile, time
from pathlib import Path

OPS = Path('/Users/apple/Documents/Playground/tencent-cloud-ops')
CLI = OPS / '.venv/bin/tccli'
INSTANCE = 'lhins-qbh2d822'
REGION = 'ap-shanghai'
ACTIVE = {'PENDING', 'DELIVERING', 'DELIVER_DELAYED', 'RUNNING', 'CANCELLING'}


def tat(action, params):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as req:
        json.dump(params, req)
        req.flush()
        cmd = [str(CLI), 'tat', action, '--profile', 'imalltrix', '--region', REGION,
               '--output', 'json', '--cli-input-json', 'file://' + req.name]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        except subprocess.TimeoutExpired:
            raise RuntimeError('请求超时。命令可能已提交，先查执行记录再决定是否重试。') from None
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip())
    data = json.loads(r.stdout)
    data = data.get('Response', data)
    if data.get('Error'):
        raise RuntimeError(json.dumps(data['Error'], ensure_ascii=False))
    return data


def wait(invocation, timeout=300):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        resp = tat('DescribeInvocationTasks', {
            'Filters': [{'Name': 'invocation-id', 'Values': [invocation]},
                        {'Name': 'instance-id', 'Values': [INSTANCE]}],
            'HideOutput': False, 'Limit': 10,
        })
        tasks = [t for t in resp.get('InvocationTaskSet', []) if t.get('InvocationId') == invocation]
        if tasks and tasks[0]['TaskStatus'] not in ACTIVE:
            task = tasks[0]
            res = task.get('TaskResult') or {}
            out = base64.b64decode(res.get('Output') or '', validate=True).decode('utf-8', 'replace')
            return task['TaskStatus'], res.get('ExitCode'), out, res.get('Dropped', 0)
        time.sleep(2)
    raise RuntimeError(f'等待超时。命令未重复提交，可用 --invocation {invocation} 继续查询。')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('script', nargs='?', help='要在服务器上执行的本地 shell 脚本')
    ap.add_argument('--root', action='store_true', help='以 root 执行（默认 ubuntu）')
    ap.add_argument('--invocation', help='只读取既有执行 ID，不重新执行')
    ap.add_argument('--timeout', type=int, default=300)
    args = ap.parse_args()

    if args.invocation:
        inv = args.invocation
    else:
        if not args.script:
            ap.error('需要提供脚本路径，或用 --invocation 查询既有结果')
        body = Path(args.script).read_bytes()
        resp = tat('RunCommand', {
            'Content': base64.b64encode(body).decode('ascii'),
            'InstanceIds': [INSTANCE],
            'CommandName': f'Oncue-{Path(args.script).stem}',
            'Description': f'OnCue deploy: {Path(args.script).name}',
            'CommandType': 'SHELL',
            'WorkingDirectory': '/tmp',
            'Username': 'root' if args.root else 'ubuntu',
            'Timeout': args.timeout,
            'SaveCommand': False,
            'EnableParameter': False,
        })
        inv = resp['InvocationId']
        print(f'>>> {Path(args.script).name}  执行 ID {inv}', flush=True)

    status, code, out, dropped = wait(inv, args.timeout + 60)
    print(out, end='' if out.endswith('\n') else '\n')
    print(f'--- 状态 {status}，退出码 {code}' + (f'，输出被截断 {dropped} 字节' if dropped else ''))
    return 0 if status == 'SUCCESS' and code == 0 and not dropped else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, RuntimeError) as exc:
        print(f'错误：{exc}', file=sys.stderr)
        sys.exit(1)
