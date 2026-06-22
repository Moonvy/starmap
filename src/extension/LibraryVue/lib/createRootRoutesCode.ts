import { CodeUnit } from "../../../core/Gen/CodeUnit"

export function createRootRoutesCode(units: CodeUnit[]) {
    let routes = units.map((unit) => {
        return `        {
            path: "/units/${unit.id}",
            name: "units-${unit.id}",
            component: () => import("./units/${unit.id}/unit.vue"),
        }`
    })

    return routes.join(",\n")
}
