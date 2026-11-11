/** Legacy imports share the same cross-platform motion registry. */
export {
 animateResultChange as animateMobileResultChange,
 animateNavigation as animateMobileNavigation,
 cancelSearchMotion as cancelMobileMotion,
} from "./searchMotion";
export type {ResultMotionOptions as MobileResultMotionOptions} from "./searchMotion";
