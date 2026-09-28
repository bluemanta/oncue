"use client";
import { FAIL_MESSAGE, type FailReason } from '../../lib/assessment';

/**
 * 拿不到麦克风时该怎么说。
 *
 * 原来统一说"在网址栏左边的图标里打开它"——那是电脑浏览器的说法。
 * 手机上没有这个图标，微信里连网址栏都没有，用户照着找不到，
 * 只会以为是自己手机坏了。所以按打开方式分开说。
 *
 * 其它几种失败（太短、太吵、没人声、服务报错）和打开方式无关，照原样。
 */

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);

/** 微信、QQ、微博这类"应用内置的浏览器"。它们通常不给网页用麦克风 */
export function inEmbeddedBrowser(): boolean {
  return /MicroMessenger|QQ\//i.test(ua()) || /Weibo/i.test(ua());
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(ua());
}

export function micFailureMessage(reason: FailReason): string {
  if (reason !== 'no_permission') return FAIL_MESSAGE[reason];

  if (inEmbeddedBrowser()) {
    return '微信里用不了麦克风。点右上角的 ⋯ ，选「在浏览器打开」，再按住试一次。';
  }
  if (isIos()) {
    return '没拿到麦克风权限。刷新一下，在弹出的询问里点「允许」；要是没弹，去 设置 → Safari → 麦克风 里改成「询问」。';
  }
  return '没拿到麦克风权限。在浏览器的网站设置里允许本站使用麦克风，再按住试一次。';
}
