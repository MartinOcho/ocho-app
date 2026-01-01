# TODO: Fix Next.js Build Errors in Route Handlers

## Steps to Complete
- [x] Update the DELETE function in `src/app/api/android/comments/[commentId]/route.ts` to make `params` asynchronous as required by Next.js 15
- [x] Update the GET function in `src/app/api/android/posts/[postId]/comments/route.ts` to make `params` asynchronous as required by Next.js 15
- [x] Update the POST function in `src/app/api/android/posts/[postId]/comments/send/route.ts` to make `params` asynchronous as required by Next.js 15
- [ ] Run the Next.js build command to verify all fixes resolve the type errors
