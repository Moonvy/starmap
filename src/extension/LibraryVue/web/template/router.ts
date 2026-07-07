import { createRouter, createWebHistory } from "@moonvy/starmap/node_modules/vue-router"

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: "/",
            name: "Root",
            // @ts-ignore
            component: () => import("{{{HomePageVuePath}}}"),
        },

        {{{routes}}}

    ],
})



// 如果存在 starmap-project-root 单元，默认跳转到该单元页面
router.beforeEach((to) => {
    if (to.path === "/") {
        // @ts-ignore
        const unitsFlat = window.__starmap__?.unitsFlat ?? []
        const hasRoot = unitsFlat.some((u: any) => u.id === "starmap-project-root")
        if (hasRoot) {
            return "/units/starmap-project-root"
        }
    }
})

// 集中处理浏览器窗口标题的更新
router.afterEach((to) => {
    try {
        // 获取全部代码单元扁平列表和项目元数据
        // @ts-ignore
        const unitsFlat = window.__starmap__?.unitsFlat ?? []
        // @ts-ignore
        const rootMetadata = window.__starmap__?.rootMetadata
        // 宿主项目名称，若未配置则默认为 "Starmap"
        const projectName = rootMetadata?.projectName ?? "Starmap"

        let pageTitle = ""
        const path = to.path

        // 如果路径是以 /units/ 开头的页面，说明是在浏览某个代码单元
        if (path.startsWith("/units/")) {
            const id = path.substring("/units/".length)
            // 根据 ID 找到对应的代码单元数据
            const unit = unitsFlat.find((u: any) => u.id === id)
            if (unit) {
                const metadata = unit.metadata
                // 优先读取一级标题，其次是配置的 title，最后是文件夹名称
                let label = metadata?.headMainTitle ?? metadata?.title ?? unit.dirName ?? "Untitled"
                label = label.trim()
                // 若标题为单个点，说明是项目根目录，显示为 "Readme"
                if (label === ".") {
                    label = "Readme"
                }
                pageTitle = label
            } else {
                pageTitle = id
            }
        } else if (path === "/") {
            pageTitle = "Home"
        } else {
            pageTitle = String(to.name || to.path)
        }

        // 设置格式化的网页标题
        document.title = `${pageTitle} - ${projectName} - Starmap`
    } catch (err) {
        console.error("[Starmap] 集中处理 window title 失败:", err)
    }
})

// @ts-ignore
window.__starmap__.__vue_router__ = router
