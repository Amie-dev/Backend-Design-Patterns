# Backend Design Patterns — Practical Learning Notes

10 core patterns + 1 AI-ready reference architecture · TypeScript · Node.js · NestJS · PostgreSQL · Distributed systems

Backend design patterns are reusable ways to solve recurring software design problems. They help you build applications that remain understandable, testable, extensible, and reliable as the codebase grows.

The goal is not to use every pattern in every project. The goal is to understand which problem a pattern solves, when to use it, how to implement it, and what trade-offs it introduces.

> 🚀 **Starting a new project?** Read the [AI-ready project blueprint](11-ai-ready-blueprint/notes.md) first — one composition of patterns 1–10, plus the AI subsystem (LLM port, guardrails, budgets, evals) every product now needs. The ten pattern folders remain the deep references.

## 1. The big picture

Data and object creation

Repository · Factory · Builder · Adapter

Separate data access, object construction, and external system interfaces.

Business logic and extensibility

Strategy · Observer · Decorator · Singleton

Organize changing rules, event-driven behavior, additional functionality, and shared resources.

Scaling and resilience

CQRS · Circuit Breaker

Separate read/write workloads and prevent failing dependencies from overwhelming your application.

**Putting it together:** the [AI-ready blueprint](11-ai-ready-blueprint/notes.md) composes all three groups into one deployable structure and adds the AI layer — model port, prompt versions, guardrails, budgets, evals, and provider failure isolation.

## 2. A common application we'll use

Imagine you're building an e-commerce backend with:

- Node.js and TypeScript, optionally using NestJS.
- PostgreSQL for orders, users, and products.
- Stripe and Razorpay for payments.
- Redis for caching and distributed coordination.
- A message broker for background jobs and events.
- External services for email, shipping, and notifications.

Initially, a single API controller might handle everything. As features grow, it becomes difficult to change one thing without breaking another.

A cleaner architecture looks like this:

\#chatgpt-mermaid-\_r_mo\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_mo\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_mo\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_mo\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_mo\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_mo\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_mo\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_mo\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_mo\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_mo\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_mo\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_mo\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_mo\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_mo\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_mo\_ p{margin:0;}#chatgpt-mermaid-\_r_mo\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_mo\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_mo\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_mo\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_mo\_ .label text,#chatgpt-mermaid-\_r_mo\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_mo\_ .node rect,#chatgpt-mermaid-\_r_mo\_ .node circle,#chatgpt-mermaid-\_r_mo\_ .node ellipse,#chatgpt-mermaid-\_r_mo\_ .node polygon,#chatgpt-mermaid-\_r_mo\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_mo\_ .rough-node .label text,#chatgpt-mermaid-\_r_mo\_ .node .label text,#chatgpt-mermaid-\_r_mo\_ .image-shape .label,#chatgpt-mermaid-\_r_mo\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_mo\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_mo\_ .rough-node .label,#chatgpt-mermaid-\_r_mo\_ .node .label,#chatgpt-mermaid-\_r_mo\_ .image-shape .label,#chatgpt-mermaid-\_r_mo\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_mo\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_mo\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_mo\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_mo\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_mo\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_mo\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_mo\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_mo\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_mo\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_mo\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_mo\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_mo\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_mo\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_mo\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_mo\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_mo\_ .icon-shape,#chatgpt-mermaid-\_r_mo\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_mo\_ .icon-shape p,#chatgpt-mermaid-\_r_mo\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_mo\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_mo\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_mo\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_mo\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_mo\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_mo\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_mo\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_mo\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_mo\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_mo\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_mo\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_mo\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_mo\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_mo\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_mo\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_mo\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_mo\_ .node rect,#chatgpt-mermaid-\_r_mo\_ .node circle,#chatgpt-mermaid-\_r_mo\_ .node ellipse,#chatgpt-mermaid-\_r_mo\_ .node polygon,#chatgpt-mermaid-\_r_mo\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_mo\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_mo\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_mo\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_mo\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_mo\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}HTTP ControllerApplication ServiceRepository InterfacePostgreSQL RepositoryStrategy / FactoryPayment Provider AdapterExternal Payment APIDomain EventBackground ConsumersEmail / Inventory / Analytics

This diagram illustrates the central idea: each component has a clear responsibility, and components communicate through deliberate interfaces.

# Pattern 1. Repository Pattern

Data access

## What problem does it solve?

Without a repository, database queries often spread across controllers and business services.

```
// A tightly coupled service
async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
}
```

This is not automatically bad in a small application. The problem appears when business rules, database queries, transformations, and transaction handling become mixed together.

If you later change your data access implementation, you may need to modify many parts of the application.

## How the repository pattern works

A repository provides a clear interface for retrieving and persisting application data. It hides database-specific operations behind that interface.

\#chatgpt-mermaid-\_r_n8\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_n8\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_n8\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_n8\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_n8\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_n8\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_n8\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_n8\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_n8\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_n8\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_n8\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_n8\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_n8\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_n8\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_n8\_ p{margin:0;}#chatgpt-mermaid-\_r_n8\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_n8\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_n8\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_n8\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_n8\_ .label text,#chatgpt-mermaid-\_r_n8\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_n8\_ .node rect,#chatgpt-mermaid-\_r_n8\_ .node circle,#chatgpt-mermaid-\_r_n8\_ .node ellipse,#chatgpt-mermaid-\_r_n8\_ .node polygon,#chatgpt-mermaid-\_r_n8\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_n8\_ .rough-node .label text,#chatgpt-mermaid-\_r_n8\_ .node .label text,#chatgpt-mermaid-\_r_n8\_ .image-shape .label,#chatgpt-mermaid-\_r_n8\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_n8\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_n8\_ .rough-node .label,#chatgpt-mermaid-\_r_n8\_ .node .label,#chatgpt-mermaid-\_r_n8\_ .image-shape .label,#chatgpt-mermaid-\_r_n8\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_n8\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_n8\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_n8\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_n8\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_n8\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_n8\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_n8\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_n8\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_n8\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_n8\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_n8\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_n8\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_n8\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_n8\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_n8\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_n8\_ .icon-shape,#chatgpt-mermaid-\_r_n8\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_n8\_ .icon-shape p,#chatgpt-mermaid-\_r_n8\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_n8\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_n8\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_n8\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_n8\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_n8\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_n8\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_n8\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_n8\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_n8\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_n8\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_n8\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_n8\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_n8\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_n8\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_n8\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_n8\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_n8\_ .node rect,#chatgpt-mermaid-\_r_n8\_ .node circle,#chatgpt-mermaid-\_r_n8\_ .node ellipse,#chatgpt-mermaid-\_r_n8\_ .node polygon,#chatgpt-mermaid-\_r_n8\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_n8\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_n8\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_n8\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_n8\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_n8\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Order ServiceOrder Repository InterfacePostgreSQL ImplementationPostgreSQLIn-memory Test Repositoryalternative

The service knows what operations are available, but it does not need to know the details of the database query.

## Practical TypeScript implementation

First, define the domain type and repository interface.

```
type Order = {
  id: string;
  userId: string;
  total: number;
  status: "pending" | "paid" | "cancelled";
};

interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
```

Then implement the interface using your database client. This example uses Prisma.

```
class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: any) {}

  async findById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        total: true,
        status: true,
      },
    });
  }

  async save(order: Order): Promise<void> {
    await this.prisma.order.upsert({
      where: { id: order.id },
      create: order,
      update: {
        total: order.total,
        status: order.status,
      },
    });
  }
}
```

The `any` type here is only a placeholder for the actual generated Prisma client type; in production, use the real client type.

Now the business service depends on the interface.

```
class OrderService {
  constructor(
    private readonly orders: OrderRepository,
  ) {}

  async getOrder(id: string): Promise<Order> {
    const order = await this.orders.findById(id);

    if (!order) {
      throw new Error("Order not found");
    }

    return order;
  }
}
```

### Production considerations

- Transactions: Multiple repository calls may need to participate in one database transaction. Define transaction boundaries explicitly instead of assuming separate calls are atomic.
- Query efficiency: Avoid loading entire object graphs when an endpoint needs only a few fields.
- Pagination: Design list methods around cursor or offset pagination where appropriate.
- Testing: Substitute a fake repository in unit tests, then separately test the real implementation against a test database.
- Don't over-abstract: A thin wrapper around every ORM method may add code without adding value. Use repositories when they create a meaningful boundary.

Use it when: Data access is complex, multiple services need consistent persistence rules, or you want to isolate database details from business logic.

# Pattern 2. Factory Pattern

Object creation

## What problem does it solve?

Suppose your application supports multiple payment providers.

```
if (provider === "stripe") {
  // Create Stripe integration
} else if (provider === "razorpay") {
  // Create Razorpay integration
} else if (provider === "paypal") {
  // Create PayPal integration
}
```

A conditional is perfectly reasonable when there are only one or two options. But if provider creation logic is repeated throughout your codebase, every new provider can require changes in several places.

A factory centralizes the decision about which implementation to create or return.

## Implementation

Start with a common contract.

```
type PaymentRequest = {
  orderId: string;
  amount: number;
  currency: string;
};

interface PaymentProvider {
  charge(input: PaymentRequest): Promise<{
    transactionId: string;
  }>;
}
```

Implement each provider behind that contract.

```
class StripeProvider implements PaymentProvider {
  async charge(input: PaymentRequest) {
    // Call Stripe SDK here.
    return { transactionId: `stripe-${input.orderId}` };
  }
}

class RazorpayProvider implements PaymentProvider {
  async charge(input: PaymentRequest) {
    // Call Razorpay SDK here.
    return { transactionId: `razorpay-${input.orderId}` };
  }
}
```

Create the factory.

```
type ProviderName = "stripe" | "razorpay";

class PaymentProviderFactory {
  constructor(
    private readonly stripe: PaymentProvider,
    private readonly razorpay: PaymentProvider,
  ) {}

  get(name: ProviderName): PaymentProvider {
    switch (name) {
      case "stripe":
        return this.stripe;
      case "razorpay":
        return this.razorpay;
    }
  }
}
```

Usage:

```
const provider = factory.get("stripe");

const result = await provider.charge({
  orderId: "order_123",
  amount: 49900,
  currency: "INR",
});
```

In this illustrative example, `49900` represents 499 rupees in paise. Actual amount units depend on the payment API and currency.

Notice that the payment service does not need to construct a Stripe SDK client itself.

## Factory vs. Strategy

These patterns are often used together, but they solve different problems.

| Pattern  | Main question                           |
| -------- | --------------------------------------- |
| Factory  | Which object should I create or return? |
| Strategy | Which algorithm should I execute?       |

A factory might select a payment strategy; the selected strategy then performs the payment operation.

### Production considerations

- Construct SDK clients through dependency injection, so credentials, timeouts, and connection settings are configured centrally.
- Do not select a payment provider using arbitrary user input without validation and authorization.
- Provider selection should account for currency, region, payment method, and business rules when necessary.
- Avoid one enormous factory that becomes a central switch statement for your entire application.

Use it when: Object creation varies by configuration, environment, provider, or business rule.

# Pattern 3. Singleton Pattern

Shared instance lifecycle

## What problem does it solve?

Some objects are expensive to construct or should have a consistent lifecycle within an application process.

Examples include:

- An application configuration service.
- A logging service.
- A database connection pool.
- A configured SDK client.

The singleton pattern ensures that a particular class exposes one instance within its intended scope.

However, one instance per process is not the same as one instance across an entire distributed system.

## Basic implementation

```
class AppConfig {
  private static instance: AppConfig;

  private constructor(
    public readonly environment: string,
  ) {}

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig(
        process.env.NODE_ENV ?? "development",
      );
    }

    return AppConfig.instance;
  }
}
```

Usage:

```
const configA = AppConfig.getInstance();
const configB = AppConfig.getInstance();

console.log(configA === configB); // true
```

This is a simple demonstration, not necessarily the best way to manage application configuration in a production service.

## The modern backend approach: dependency injection

Frameworks such as NestJS let you manage service lifecycles through providers.

```
import { Injectable } from "@nestjs/common";

@Injectable()
export class AppConfigService {
  get environment(): string {
    return process.env.NODE_ENV ?? "development";
  }
}
```

NestJS providers are singleton-scoped by default within a given application context unless another scope is specified.

This generally provides the benefits of a shared instance without requiring manual singleton logic.

## Important production distinction

| Resource                   | Typical approach                                        |
| -------------------------- | ------------------------------------------------------- |
| Configuration service      | Shared provider                                         |
| Logger                     | Shared provider                                         |
| Database pool              | Shared pool per process                                 |
| User-specific request data | Request-scoped or explicit context                      |
| Cross-server lock          | Distributed coordination mechanism                      |
| Global job deduplication   | Database constraint, Redis, or another shared mechanism |

If you run five backend instances, each instance may have its own singleton. Never rely on an in-memory singleton for global consistency, distributed locking, or cross-server rate limiting.

Also avoid storing mutable user-specific state in a global service. One request must not accidentally observe another user's data.

Use it when: A shared instance is genuinely appropriate and its lifecycle is well understood. Prefer dependency injection over manually enforcing singleton behavior in most modern applications.

# Pattern 4. Strategy Pattern

Business rules

## What problem does it solve?

Imagine your e-commerce platform supports different discount rules:

- Premium customers receive a 15% discount.
- Students receive a 10% discount.
- Festival promotions offer a fixed discount.
- Some products are excluded from promotions.

A common beginner implementation puts every rule into one method.

```
function calculateDiscount(
  type: string,
  amount: number,
): number {
  if (type === "premium") {
    return amount * 0.15;
  }

  if (type === "student") {
    return amount * 0.1;
  }

  if (type === "festival") {
    return 100;
  }

  return 0;
}
```

This works initially. But as rules become more complicated, this function can become difficult to test and extend.

## The strategy solution

Each discount algorithm gets its own implementation behind a shared interface.

\#chatgpt-mermaid-\_r_q5\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_q5\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_q5\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_q5\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_q5\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_q5\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_q5\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_q5\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_q5\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_q5\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_q5\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_q5\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_q5\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_q5\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_q5\_ p{margin:0;}#chatgpt-mermaid-\_r_q5\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_q5\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_q5\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_q5\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_q5\_ .label text,#chatgpt-mermaid-\_r_q5\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_q5\_ .node rect,#chatgpt-mermaid-\_r_q5\_ .node circle,#chatgpt-mermaid-\_r_q5\_ .node ellipse,#chatgpt-mermaid-\_r_q5\_ .node polygon,#chatgpt-mermaid-\_r_q5\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_q5\_ .rough-node .label text,#chatgpt-mermaid-\_r_q5\_ .node .label text,#chatgpt-mermaid-\_r_q5\_ .image-shape .label,#chatgpt-mermaid-\_r_q5\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_q5\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_q5\_ .rough-node .label,#chatgpt-mermaid-\_r_q5\_ .node .label,#chatgpt-mermaid-\_r_q5\_ .image-shape .label,#chatgpt-mermaid-\_r_q5\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_q5\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_q5\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_q5\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_q5\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_q5\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_q5\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_q5\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_q5\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_q5\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_q5\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_q5\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_q5\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_q5\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_q5\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_q5\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_q5\_ .icon-shape,#chatgpt-mermaid-\_r_q5\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_q5\_ .icon-shape p,#chatgpt-mermaid-\_r_q5\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_q5\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_q5\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_q5\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_q5\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_q5\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_q5\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_q5\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_q5\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_q5\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q5\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_q5\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q5\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_q5\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_q5\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_q5\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_q5\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_q5\_ .node rect,#chatgpt-mermaid-\_r_q5\_ .node circle,#chatgpt-mermaid-\_r_q5\_ .node ellipse,#chatgpt-mermaid-\_r_q5\_ .node polygon,#chatgpt-mermaid-\_r_q5\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_q5\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_q5\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_q5\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_q5\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_q5\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Checkout ServiceDiscount StrategyPremium DiscountStudent DiscountFestival Discount

### Implementation

```
interface DiscountStrategy {
  calculate(amount: number): number;
}

class PremiumDiscount implements DiscountStrategy {
  calculate(amount: number): number {
    return amount * 0.15;
  }
}

class StudentDiscount implements DiscountStrategy {
  calculate(amount: number): number {
    return amount * 0.10;
  }
}

class FestivalDiscount implements DiscountStrategy {
  calculate(amount: number): number {
    return Math.min(100, amount);
  }
}
```

Create a service that uses the selected strategy.

```
class CheckoutService {
  calculateDiscount(
    amount: number,
    strategy: DiscountStrategy,
  ): number {
    return strategy.calculate(amount);
  }
}

const checkout = new CheckoutService();

const discount = checkout.calculateDiscount(
  1000,
  new PremiumDiscount(),
);

console.log(discount); // 150
```

Here, each strategy is independently testable. You can add a new discount implementation without rewriting the existing discount algorithms.

In a NestJS application, you can register strategies as providers and inject them into the checkout service. A registry can select a strategy based on a validated customer category or promotion configuration.

## When strategy becomes valuable

The pattern is especially useful when behavior changes based on context:

- Authentication: password, OTP, or external identity provider.
- Shipping: standard, express, or international.
- Pricing: customer-specific or region-specific pricing.
- AI applications: different model providers or retrieval strategies.
- File processing: PDF, CSV, or image processing pipelines.

### Production considerations

1. Validate inputs: A strategy should not allow a negative amount or an unsupported customer category.
2. Keep selection separate: Choosing a strategy and executing it are distinct responsibilities.
3. Avoid needless classes: Three trivial conditions do not automatically justify a strategy architecture.
4. Test boundaries: For discounts, test zero amounts, maximum discounts, excluded products, and rounding rules.
5. Beware of rule conflicts: If multiple promotions can apply, define an explicit precedence or combination policy.

Use it when: You have multiple interchangeable algorithms and expect their rules to change independently.

# Pattern 5. Observer Pattern

Events and notifications

## What problem does it solve?

When a customer places an order, several things might need to happen:

1. Save the order.
2. Update inventory.
3. Send a confirmation email.
4. Award loyalty points.
5. Record analytics.
6. Notify the warehouse.

A tightly coupled implementation might look like this:

```
async function placeOrder() {
  await saveOrder();
  await updateInventory();
  await sendEmail();
  await awardPoints();
  await recordAnalytics();
}
```

The order service now depends on every downstream operation. If the email service is slow or unavailable, it might delay the checkout flow.

## How the observer pattern works

A component publishes an event. Other components subscribe to events they care about and respond independently.

\#chatgpt-mermaid-\_r_r3\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_r3\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_r3\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_r3\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_r3\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_r3\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_r3\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_r3\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_r3\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_r3\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_r3\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_r3\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_r3\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_r3\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_r3\_ p{margin:0;}#chatgpt-mermaid-\_r_r3\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_r3\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_r3\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_r3\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_r3\_ .label text,#chatgpt-mermaid-\_r_r3\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_r3\_ .node rect,#chatgpt-mermaid-\_r_r3\_ .node circle,#chatgpt-mermaid-\_r_r3\_ .node ellipse,#chatgpt-mermaid-\_r_r3\_ .node polygon,#chatgpt-mermaid-\_r_r3\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_r3\_ .rough-node .label text,#chatgpt-mermaid-\_r_r3\_ .node .label text,#chatgpt-mermaid-\_r_r3\_ .image-shape .label,#chatgpt-mermaid-\_r_r3\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_r3\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_r3\_ .rough-node .label,#chatgpt-mermaid-\_r_r3\_ .node .label,#chatgpt-mermaid-\_r_r3\_ .image-shape .label,#chatgpt-mermaid-\_r_r3\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_r3\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_r3\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_r3\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_r3\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_r3\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_r3\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_r3\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_r3\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_r3\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_r3\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_r3\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_r3\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_r3\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_r3\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_r3\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_r3\_ .icon-shape,#chatgpt-mermaid-\_r_r3\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_r3\_ .icon-shape p,#chatgpt-mermaid-\_r_r3\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_r3\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_r3\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_r3\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_r3\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_r3\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_r3\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_r3\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_r3\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_r3\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_r3\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_r3\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_r3\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_r3\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_r3\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_r3\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_r3\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_r3\_ .node rect,#chatgpt-mermaid-\_r_r3\_ .node circle,#chatgpt-mermaid-\_r_r3\_ .node ellipse,#chatgpt-mermaid-\_r_r3\_ .node polygon,#chatgpt-mermaid-\_r_r3\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_r3\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_r3\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_r3\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_r3\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_r3\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Order ServiceOrder Placed EventInventory HandlerEmail HandlerLoyalty HandlerAnalytics Handler

The publisher does not need to know the internal implementation of each subscriber.

## A simple TypeScript example

For an in-process event dispatcher:

```
type OrderPlaced = {
  orderId: string;
  userId: string;
  total: number;
};

type Events = {
  "order.placed": OrderPlaced;
};

class EventBus {
  private handlers = new Map<
    string,
    Array<(event: any) => Promise<void>>
  >();

  on<K extends keyof Events>(
    name: K,
    handler: (event: Events[K]) => Promise<void>,
  ) {
    const list = this.handlers.get(name) ?? [];
    list.push(handler);
    this.handlers.set(name, list);
  }

  async publish<K extends keyof Events>(
    name: K,
    event: Events[K],
  ) {
    const list = this.handlers.get(name) ?? [];
    await Promise.all(list.map(handler => handler(event)));
  }
}
```

Register a subscriber:

```
eventBus.on("order.placed", async event => {
  await emailService.sendConfirmation(event.userId);
});
```

Publish an event:

```
await eventBus.publish("order.placed", {
  orderId: "order_123",
  userId: "user_456",
  total: 499,
});
```

This is a teaching example. The simplified dispatcher uses `any`, has no persistent storage, and propagates subscriber failures to the publisher. Those limitations matter in production.

## In-process observer vs. message broker

These approaches are related, but they are not interchangeable.

| In-process events                     | Broker-based events                         |
| ------------------------------------- | ------------------------------------------- |
| Communicate within one process        | Communicate across processes or services    |
| Usually simple to implement           | Require broker infrastructure               |
| Events can be lost on process failure | Durable delivery can be configured          |
| Handlers can share memory             | Consumers communicate through messages      |
| Good for local application events     | Good for asynchronous distributed workflows |

Technologies such as RabbitMQ, Kafka, Amazon SNS/SQS, and Google Pub/Sub support different event and messaging models.

## The critical production issue: dual writes

Consider this sequence:

```
1. Save order to PostgreSQL.
2. Publish OrderPlaced to the broker.
```

What happens if step 1 succeeds but the application crashes before step 2?

The order exists, but inventory and notifications may never learn about it.

A common solution is the transactional outbox pattern:

\#chatgpt-mermaid-\_r_s7\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_s7\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_s7\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_s7\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_s7\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_s7\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_s7\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_s7\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_s7\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_s7\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_s7\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_s7\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_s7\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_s7\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_s7\_ p{margin:0;}#chatgpt-mermaid-\_r_s7\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_s7\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_s7\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_s7\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_s7\_ .label text,#chatgpt-mermaid-\_r_s7\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_s7\_ .node rect,#chatgpt-mermaid-\_r_s7\_ .node circle,#chatgpt-mermaid-\_r_s7\_ .node ellipse,#chatgpt-mermaid-\_r_s7\_ .node polygon,#chatgpt-mermaid-\_r_s7\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_s7\_ .rough-node .label text,#chatgpt-mermaid-\_r_s7\_ .node .label text,#chatgpt-mermaid-\_r_s7\_ .image-shape .label,#chatgpt-mermaid-\_r_s7\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_s7\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_s7\_ .rough-node .label,#chatgpt-mermaid-\_r_s7\_ .node .label,#chatgpt-mermaid-\_r_s7\_ .image-shape .label,#chatgpt-mermaid-\_r_s7\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_s7\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_s7\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_s7\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_s7\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_s7\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_s7\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_s7\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_s7\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_s7\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_s7\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_s7\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_s7\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_s7\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_s7\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_s7\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_s7\_ .icon-shape,#chatgpt-mermaid-\_r_s7\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_s7\_ .icon-shape p,#chatgpt-mermaid-\_r_s7\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_s7\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_s7\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_s7\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_s7\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_s7\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_s7\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_s7\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_s7\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_s7\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_s7\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_s7\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_s7\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_s7\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_s7\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_s7\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_s7\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_s7\_ .node rect,#chatgpt-mermaid-\_r_s7\_ .node circle,#chatgpt-mermaid-\_r_s7\_ .node ellipse,#chatgpt-mermaid-\_r_s7\_ .node polygon,#chatgpt-mermaid-\_r_s7\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_s7\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_s7\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_s7\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_s7\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_s7\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Order ServiceOne DB TransactionOrders TableOutbox TableOutbox PublisherMessage BrokerConsumers

The order and its event record are committed in the same database transaction. A separate publisher delivers the event to the broker and marks it as published.

Even then, duplicate deliveries are possible. Consumers should be idempotent, meaning processing the same event twice does not produce the business effect twice.

For inventory, use database constraints, conditional updates, or deduplication records as appropriate. For payments, use provider-supported idempotency keys.

Use it when: One business event needs to trigger several independent reactions, especially asynchronous work. Use durable messaging when losing an event would violate business requirements.

# Pattern 6. Builder Pattern

Complex object construction

## What problem does it solve?

Suppose you're creating a report configuration with many optional properties:

```
const report = new Report(
  "sales",
  "monthly",
  true,
  false,
  100,
  "csv",
);
```

The call does not communicate clearly what each boolean or number means. A future developer might pass arguments in the wrong order.

The builder pattern lets you construct an object incrementally with named operations.

## Implementation

Define the final configuration type.

```
type ReportConfig = {
  name: string;
  format: "csv" | "json";
  includeArchived: boolean;
  maxRows: number;
};
```

Create a builder that validates the configuration before returning it.

```
class ReportBuilder {
  private config: ReportConfig = {
    name: "default",
    format: "json",
    includeArchived: false,
    maxRows: 1000,
  };

  setName(name: string): this {
    this.config.name = name;
    return this;
  }

  setFormat(format: "csv" | "json"): this {
    this.config.format = format;
    return this;
  }

  includeArchived(value: boolean): this {
    this.config.includeArchived = value;
    return this;
  }

  setMaxRows(value: number): this {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error("maxRows must be a positive integer");
    }

    this.config.maxRows = value;
    return this;
  }

  build(): ReportConfig {
    if (!this.config.name.trim()) {
      throw new Error("Report name is required");
    }

    return { ...this.config };
  }
}
```

Usage:

```
const report = new ReportBuilder()
  .setName("Monthly Sales")
  .setFormat("csv")
  .includeArchived(false)
  .setMaxRows(5000)
  .build();
```

The resulting object is easy to read because each setting is explicitly named.

## When to use it

Builder patterns are useful for:

- Complex report configurations.
- AI inference options with model, temperature, token limits, and tools.
- Query construction.
- Cloud SDK configuration.
- Test data factories.
- Objects with many optional settings and cross-field validation.

### Production considerations

- Apply defaults in one place.
- Validate required fields and relationships between fields.
- Avoid exposing mutable internal configuration after `build()`.
- For simple DTOs, ordinary object literals and TypeScript types may be sufficient.

In JavaScript and TypeScript, a builder is not always necessary. For example, this is often clear enough:

```
const config: ReportConfig = {
  name: "Monthly Sales",
  format: "csv",
  includeArchived: false,
  maxRows: 5000,
};
```

Use it when: Object construction has many steps, meaningful validation, optional settings, or several valid configuration stages.

# Pattern 7. Adapter Pattern

External integrations

## What problem does it solve?

Your application expects a consistent interface, but external providers implement different APIs.

For example, one payment provider might return:

```
{
  "payment_id": "pay_123",
  "payment_status": "captured"
}
```

Another might return:

```
{
  "id": "txn_456",
  "status": "success"
}
```

If your entire application depends on these provider-specific field names, changing a provider becomes expensive.

## How the adapter works

An adapter translates an external API into an interface your application understands.

\#chatgpt-mermaid-\_r_u1\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_u1\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_u1\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_u1\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_u1\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_u1\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_u1\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_u1\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_u1\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_u1\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_u1\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_u1\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_u1\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_u1\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_u1\_ p{margin:0;}#chatgpt-mermaid-\_r_u1\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_u1\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_u1\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_u1\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_u1\_ .label text,#chatgpt-mermaid-\_r_u1\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_u1\_ .node rect,#chatgpt-mermaid-\_r_u1\_ .node circle,#chatgpt-mermaid-\_r_u1\_ .node ellipse,#chatgpt-mermaid-\_r_u1\_ .node polygon,#chatgpt-mermaid-\_r_u1\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_u1\_ .rough-node .label text,#chatgpt-mermaid-\_r_u1\_ .node .label text,#chatgpt-mermaid-\_r_u1\_ .image-shape .label,#chatgpt-mermaid-\_r_u1\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_u1\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_u1\_ .rough-node .label,#chatgpt-mermaid-\_r_u1\_ .node .label,#chatgpt-mermaid-\_r_u1\_ .image-shape .label,#chatgpt-mermaid-\_r_u1\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_u1\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_u1\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_u1\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_u1\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_u1\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_u1\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_u1\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_u1\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_u1\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_u1\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_u1\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_u1\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_u1\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_u1\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_u1\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_u1\_ .icon-shape,#chatgpt-mermaid-\_r_u1\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_u1\_ .icon-shape p,#chatgpt-mermaid-\_r_u1\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_u1\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_u1\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_u1\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_u1\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_u1\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_u1\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_u1\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_u1\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_u1\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_u1\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_u1\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_u1\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_u1\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_u1\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_u1\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_u1\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_u1\_ .node rect,#chatgpt-mermaid-\_r_u1\_ .node circle,#chatgpt-mermaid-\_r_u1\_ .node ellipse,#chatgpt-mermaid-\_r_u1\_ .node polygon,#chatgpt-mermaid-\_r_u1\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_u1\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_u1\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_u1\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_u1\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_u1\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Payment ServicePayment InterfaceStripe AdapterRazorpay AdapterStripe APIRazorpay API

### Implementation

Define your application's normalized result.

```
type PaymentResult = {
  transactionId: string;
  status: "succeeded" | "pending" | "failed";
};

interface PaymentGateway {
  createPayment(
    amount: number,
    currency: string,
  ): Promise<PaymentResult>;
}
```

An adapter implements the interface and translates the provider response.

```
class StripeAdapter implements PaymentGateway {
  constructor(
    private readonly stripe: {
      createPayment(input: {
        amount: number;
        currency: string;
      }): Promise<{
        id: string;
        status: string;
      }>;
    },
  ) {}

  async createPayment(
    amount: number,
    currency: string,
  ): Promise<PaymentResult> {
    const result = await this.stripe.createPayment({
      amount,
      currency,
    });

    return {
      transactionId: result.id,
      status:
        result.status === "succeeded"
          ? "succeeded"
          : result.status === "pending"
            ? "pending"
            : "failed",
    };
  }
}
```

The payment service uses `PaymentGateway`, not Stripe-specific fields.

## Why the adapter is valuable

If the external API changes, the adapter becomes the primary place to update the translation. The rest of your business logic can remain stable.

Adapters are useful for:

- Payment gateways.
- Shipping providers.
- SMS and email vendors.
- Cloud storage providers.
- Legacy SOAP/XML APIs.
- Third-party AI model APIs.

### Production considerations

1. Do not blindly map unknown statuses to failure. Some providers add new statuses. Explicitly handle unknown or unsupported values.
2. Validate external responses. Treat responses as untrusted input, even when using an SDK.
3. Preserve useful error information. Normalize errors without losing provider error codes needed for debugging.
4. Keep provider-specific capabilities visible when necessary. Not every provider supports the same features; avoid pretending all implementations are identical.
5. Test contracts. Run integration or contract tests against provider SDKs or sandbox environments.

Use it when: Your application needs to integrate external systems while maintaining a consistent internal interface.

# Pattern 8. Decorator Pattern

Cross-cutting behavior

## What problem does it solve?

Imagine you have a service that fetches product information. Over time, you want to add:

- Caching to reduce database load.
- Logging to debug slow requests.
- Metrics to measure latency.
- Authorization checks.
- Auditing for sensitive operations.

One approach is to keep modifying the original service. But eventually, its main responsibility becomes mixed with several unrelated concerns.

A decorator adds behavior around an existing implementation without requiring the original implementation to know about it.

## How the decorator works

\#chatgpt-mermaid-\_r_uo\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_uo\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_uo\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_uo\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_uo\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_uo\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_uo\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_uo\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_uo\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_uo\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_uo\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_uo\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_uo\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_uo\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_uo\_ p{margin:0;}#chatgpt-mermaid-\_r_uo\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_uo\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_uo\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_uo\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_uo\_ .label text,#chatgpt-mermaid-\_r_uo\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_uo\_ .node rect,#chatgpt-mermaid-\_r_uo\_ .node circle,#chatgpt-mermaid-\_r_uo\_ .node ellipse,#chatgpt-mermaid-\_r_uo\_ .node polygon,#chatgpt-mermaid-\_r_uo\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_uo\_ .rough-node .label text,#chatgpt-mermaid-\_r_uo\_ .node .label text,#chatgpt-mermaid-\_r_uo\_ .image-shape .label,#chatgpt-mermaid-\_r_uo\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_uo\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_uo\_ .rough-node .label,#chatgpt-mermaid-\_r_uo\_ .node .label,#chatgpt-mermaid-\_r_uo\_ .image-shape .label,#chatgpt-mermaid-\_r_uo\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_uo\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_uo\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_uo\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_uo\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_uo\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_uo\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_uo\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_uo\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_uo\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_uo\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_uo\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_uo\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_uo\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_uo\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_uo\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_uo\_ .icon-shape,#chatgpt-mermaid-\_r_uo\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_uo\_ .icon-shape p,#chatgpt-mermaid-\_r_uo\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_uo\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_uo\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_uo\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_uo\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_uo\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_uo\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_uo\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_uo\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_uo\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_uo\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_uo\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_uo\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_uo\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_uo\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_uo\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_uo\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_uo\_ .node rect,#chatgpt-mermaid-\_r_uo\_ .node circle,#chatgpt-mermaid-\_r_uo\_ .node ellipse,#chatgpt-mermaid-\_r_uo\_ .node polygon,#chatgpt-mermaid-\_r_uo\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_uo\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_uo\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_uo\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_uo\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_uo\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}RequestMetrics DecoratorLogging DecoratorCaching DecoratorProduct ServiceDatabase

This is one possible composition. The order matters: a cache hit might bypass the database and any logging or metrics placed inside the cache layer.

## Practical implementation

Start with a service contract.

```
type Product = {
  id: string;
  name: string;
  price: number;
};

interface ProductService {
  getProduct(id: string): Promise<Product>;
}
```

Implement the core service.

```
class DatabaseProductService implements ProductService {
  constructor(
    private readonly repository: {
      findById(id: string): Promise<Product | null>;
    },
  ) {}

  async getProduct(id: string): Promise<Product> {
    const product = await this.repository.findById(id);

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }
}
```

Now wrap it with a logging decorator.

```
class LoggingProductService implements ProductService {
  constructor(
    private readonly inner: ProductService,
    private readonly logger: {
      info(message: string): void;
      error(message: string): void;
    },
  ) {}

  async getProduct(id: string): Promise<Product> {
    const start = Date.now();

    try {
      const result = await this.inner.getProduct(id);

      this.logger.info(
        `getProduct succeeded in ${Date.now() - start}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(`getProduct failed for ${id}`);
      throw error;
    }
  }
}
```

Compose the services:

```
const core = new DatabaseProductService(repository);

const products = new LoggingProductService(
  core,
  logger,
);

const product = await products.getProduct("product_123");
```

The caller uses the same `ProductService` interface whether or not logging is enabled.

## Decorator vs. middleware vs. interceptor

These concepts overlap, but they are not identical.

| Mechanism             | Typical purpose                                                               |
| --------------------- | ----------------------------------------------------------------------------- |
| Object decorator      | Wrap a component with additional behavior                                     |
| HTTP middleware       | Process requests and responses at the HTTP pipeline level                     |
| Framework interceptor | Wrap handler execution, often for logging, timing, or response transformation |
| Proxy                 | Control or intercept access to another object                                 |

For example, a NestJS interceptor can measure controller execution time. A product-service decorator can cache or instrument service operations independently of HTTP.

### Production considerations

- Define which operations are cached and how cache invalidation works.
- Never cache sensitive user-specific responses under a shared key.
- Avoid logging passwords, access tokens, payment credentials, or unnecessary personal data.
- Preserve errors rather than silently converting failures into success.
- Watch for excessive wrapper nesting, which can make debugging harder.

Use it when: You need to add optional or composable behavior around an existing component while keeping its core responsibility focused.

# Pattern 9. CQRS — Command Query Responsibility Segregation

Read/write architecture

## What problem does it solve?

Most CRUD applications use the same application model for reading and changing data.

For example, a user profile endpoint might read dozens of related fields, while a profile update only needs to change a user's display name.

As traffic grows, read operations and write operations may develop very different needs:

- Reads need fast filtering, sorting, pagination, and aggregation.
- Writes need validation, business rules, and transaction safety.
- Read traffic may be far higher than write traffic.
- Different views may require data from multiple tables or services.

CQRS separates the responsibility for changing data from the responsibility for retrieving data.

## The core concept

A command expresses an intention to change state.

Examples:

- `CreateOrder`
- `UpdateProfile`
- `CancelSubscription`

A query requests information without changing application state.

Examples:

- `GetOrderDetails`
- `SearchProducts`
- `GetCustomerDashboard`

\#chatgpt-mermaid-\_r_vt\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_vt\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_vt\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_vt\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_vt\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vt\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_vt\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_vt\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_vt\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_vt\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_vt\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_vt\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vt\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vt\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_vt\_ p{margin:0;}#chatgpt-mermaid-\_r_vt\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vt\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vt\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vt\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_vt\_ .label text,#chatgpt-mermaid-\_r_vt\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vt\_ .node rect,#chatgpt-mermaid-\_r_vt\_ .node circle,#chatgpt-mermaid-\_r_vt\_ .node ellipse,#chatgpt-mermaid-\_r_vt\_ .node polygon,#chatgpt-mermaid-\_r_vt\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_vt\_ .rough-node .label text,#chatgpt-mermaid-\_r_vt\_ .node .label text,#chatgpt-mermaid-\_r_vt\_ .image-shape .label,#chatgpt-mermaid-\_r_vt\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_vt\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_vt\_ .rough-node .label,#chatgpt-mermaid-\_r_vt\_ .node .label,#chatgpt-mermaid-\_r_vt\_ .image-shape .label,#chatgpt-mermaid-\_r_vt\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_vt\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_vt\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vt\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vt\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_vt\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_vt\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_vt\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_vt\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_vt\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_vt\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_vt\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vt\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vt\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_vt\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vt\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_vt\_ .icon-shape,#chatgpt-mermaid-\_r_vt\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_vt\_ .icon-shape p,#chatgpt-mermaid-\_r_vt\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_vt\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_vt\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_vt\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_vt\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_vt\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_vt\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_vt\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_vt\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_vt\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vt\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_vt\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vt\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_vt\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_vt\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_vt\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_vt\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_vt\_ .node rect,#chatgpt-mermaid-\_r_vt\_ .node circle,#chatgpt-mermaid-\_r_vt\_ .node ellipse,#chatgpt-mermaid-\_r_vt\_ .node polygon,#chatgpt-mermaid-\_r_vt\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_vt\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_vt\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_vt\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_vt\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vt\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}API RequestCommand or Query?Command HandlerBusiness RulesWrite DatabaseQuery HandlerRead ModelCommandQueryoptional event / projectionupdate

The diagram shows a possible CQRS architecture. CQRS does not require separate databases or an event-driven architecture.

## Practical TypeScript example

Define a command handler:

```
type UpdateProfileCommand = {
  userId: string;
  displayName: string;
};

class UpdateProfileHandler {
  constructor(
    private readonly users: {
      updateDisplayName(
        id: string,
        name: string,
      ): Promise<void>;
    },
  ) {}

  async execute(command: UpdateProfileCommand) {
    const name = command.displayName.trim();

    if (name.length < 2 || name.length > 80) {
      throw new Error("Invalid display name");
    }

    await this.users.updateDisplayName(
      command.userId,
      name,
    );
  }
}
```

Define a separate query handler:

```
type ProfileView = {
  id: string;
  displayName: string;
  orderCount: number;
};

class GetProfileHandler {
  constructor(
    private readonly readRepository: {
      getProfileView(id: string): Promise<ProfileView | null>;
    },
  ) {}

  async execute(userId: string): Promise<ProfileView> {
    const profile =
      await this.readRepository.getProfileView(userId);

    if (!profile) {
      throw new Error("Profile not found");
    }

    return profile;
  }
}
```

The write handler enforces a business rule. The query handler retrieves a purpose-built view. They have separate responsibilities, even if they use the same PostgreSQL database.

## Levels of CQRS

| Level   | Architecture                                             | When it makes sense                                     |
| ------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Level 1 | Separate command and query handlers                      | Many growing applications                               |
| Level 2 | Different write and read models                          | Complex reporting or read optimization                  |
| Level 3 | Separate read/write storage and asynchronous projections | High-scale workloads with acceptable consistency delays |

Start at the simplest level that solves the problem.

### Production trade-offs

Eventual consistency: If writes update the read model asynchronously, a user might create an order and immediately see an older order list. You need a product decision about acceptable delays and read-after-write behavior.

Operational complexity: Separate databases require replication or projection logic, monitoring, recovery, and schema evolution.

Transaction boundaries: Commands that enforce invariants must remain safe under concurrent requests. Database constraints and transactions are often essential.

Security: Query handlers must enforce authorization too. Separating reads and writes does not automatically make access safe.

Testing: Test command business rules and query correctness separately, including projection lag if applicable.

Use it when: Read and write workloads or business responsibilities are meaningfully different. Avoid introducing separate databases and asynchronous projections just because the pattern sounds scalable.

# Pattern 10. Circuit Breaker Pattern

Reliability and fault tolerance

## What problem does it solve?

Your backend depends on an external payment API.

Normally, requests finish in 200 milliseconds. One day, the provider begins timing out and requests take 20 seconds.

Without appropriate safeguards:

1. Requests keep waiting.
2. Connections and request handlers remain occupied.
3. Retries increase traffic to the failing provider.
4. Queues grow and unrelated requests slow down.
5. Your own service can become unhealthy.

A circuit breaker temporarily stops calls to a dependency after repeated failures, giving it time to recover.

## The three states

1\. Closed

Requests flow normally. Failures are monitored. If the configured failure threshold is reached, the circuit opens.

2\. Open

Calls are rejected immediately without contacting the failing dependency. The application returns a suitable error or uses a safe fallback.

3\. Half-open

After a recovery interval, a limited number of probe requests are allowed. If they succeed, the circuit closes; if they fail, it opens again.

## State transition diagram

\#chatgpt-mermaid-\_r_10k\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_10k\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_10k\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_10k\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_10k\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_10k\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_10k\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_10k\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_10k\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_10k\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_10k\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_10k\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_10k\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_10k\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_10k\_ p{margin:0;}#chatgpt-mermaid-\_r_10k\_ defs [id$="-barbEnd"]{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_10k\_ g.stateGroup text{fill:rgb(31, 78, 148);stroke:none;font-size:10px;}#chatgpt-mermaid-\_r_10k\_ g.stateGroup text{fill:rgb(237, 237, 237);stroke:none;font-size:10px;}#chatgpt-mermaid-\_r_10k\_ g.stateGroup .state-title{font-weight:bolder;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_10k\_ g.stateGroup rect{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_10k\_ g.stateGroup line{stroke:rgb(175, 175, 175);stroke-width:1;}#chatgpt-mermaid-\_r_10k\_ .transition{stroke:rgb(175, 175, 175);stroke-width:1;fill:none;}#chatgpt-mermaid-\_r_10k\_ .stateGroup .composit{fill:transparent;border-bottom:1px;}#chatgpt-mermaid-\_r_10k\_ .stateGroup .alt-composit{fill:#e0e0e0;border-bottom:1px;}#chatgpt-mermaid-\_r_10k\_ .state-note{stroke:rgb(58, 132, 63);fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_10k\_ .state-note text{fill:rgb(237, 237, 237);stroke:none;font-size:10px;}#chatgpt-mermaid-\_r_10k\_ .stateLabel .box{stroke:none;stroke-width:0;fill:rgb(9, 23, 44);opacity:0.5;}#chatgpt-mermaid-\_r_10k\_ .edgeLabel .label rect{fill:rgb(9, 23, 44);opacity:0.5;}#chatgpt-mermaid-\_r_10k\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_10k\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_10k\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_10k\_ .edgeLabel .label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_10k\_ .label div .edgeLabel{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_10k\_ .stateLabel text{fill:rgb(237, 237, 237);font-size:10px;font-weight:bold;}#chatgpt-mermaid-\_r_10k\_ .node circle.state-start{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_10k\_ .node .fork-join{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_10k\_ .node circle.state-end{fill:rgb(31, 78, 148);stroke:transparent;stroke-width:1.5;}#chatgpt-mermaid-\_r_10k\_ .end-state-inner{fill:transparent;stroke-width:1.5;}#chatgpt-mermaid-\_r_10k\_ .node rect{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_10k\_ .node polygon{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_10k\_ [id$="-barbEnd"]{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_10k\_ .statediagram-cluster rect{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_10k\_ .cluster-label,#chatgpt-mermaid-\_r_10k\_ .nodeLabel{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_10k\_ .statediagram-cluster rect.outer{rx:5px;ry:5px;}#chatgpt-mermaid-\_r_10k\_ .statediagram-state .divider{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_10k\_ .statediagram-state .title-state{rx:5px;ry:5px;}#chatgpt-mermaid-\_r_10k\_ .statediagram-cluster.statediagram-cluster .inner{fill:transparent;}#chatgpt-mermaid-\_r_10k\_ .statediagram-cluster.statediagram-cluster-alt .inner{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_10k\_ .statediagram-cluster .inner{rx:0;ry:0;}#chatgpt-mermaid-\_r_10k\_ .statediagram-state rect.basic{rx:5px;ry:5px;}#chatgpt-mermaid-\_r_10k\_ .statediagram-state rect.divider{stroke-dasharray:10,10;fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_10k\_ .note-edge{stroke-dasharray:5;}#chatgpt-mermaid-\_r_10k\_ .statediagram-note rect{fill:rgb(48, 48, 48);stroke:rgb(58, 132, 63);stroke-width:1px;rx:0;ry:0;}#chatgpt-mermaid-\_r_10k\_ .statediagram-note rect{fill:rgb(48, 48, 48);stroke:rgb(58, 132, 63);stroke-width:1px;rx:0;ry:0;}#chatgpt-mermaid-\_r_10k\_ .statediagram-note text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_10k\_ .statediagram-note .nodeLabel{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_10k\_ .statediagram .edgeLabel{color:red;}#chatgpt-mermaid-\_r_10k\_ [id$="-dependencyStart"],#chatgpt-mermaid-\_r_10k\_ [id$="-dependencyEnd"]{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);stroke-width:1;}#chatgpt-mermaid-\_r_10k\_ .statediagramTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].statediagram-cluster rect{fill:rgb(9, 23, 44);stroke:url(#chatgpt-mermaid-\_r_10k\_-gradient);stroke-width:1;}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].statediagram-cluster rect.outer{rx:5px;ry:5px;filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_10k\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_10k\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_10k\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_10k\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_10k\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_10k\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_10k\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_10k\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}ClosedOpenHalfOpenFailure threshold reachedRecovery interval elapsedProbe succeedsProbe fails

## A practical implementation approach

In production, prefer a maintained library rather than implementing concurrency-sensitive circuit-breaker logic from scratch.

For Node.js and TypeScript, a library such as `opossum` can provide circuit-breaker functionality. In Java ecosystems, Resilience4j is a common choice.

Conceptually:

```
async function createPayment(input: PaymentRequest) {
  return paymentBreaker.fire(input);
}
```

Here, `paymentBreaker` represents a configured circuit-breaker instance wrapping the actual provider call. The snippet illustrates usage, not a complete library configuration.

A typical configuration needs:

- A request timeout.
- A failure threshold or rolling failure window.
- A recovery delay.
- A limited number of half-open probe calls.
- Error classification.
- Metrics and logging.

## Circuit breaker vs. retries vs. timeouts

These are complementary techniques, not substitutes.

| Technique       | What it does                                         |
| --------------- | ---------------------------------------------------- |
| Timeout         | Stops waiting indefinitely for one operation         |
| Retry           | Attempts a failed operation again                    |
| Circuit breaker | Stops repeated calls to an unhealthy dependency      |
| Bulkhead        | Limits how many resources one dependency can consume |
| Rate limiter    | Limits request frequency                             |

For example, a payment request might use a timeout, bounded retries for transient errors, and a circuit breaker to prevent repeated calls when the provider is unhealthy.

### Payment-specific warning

A timeout does not prove that a payment failed. The provider may have processed the payment but failed to return the response.

Do not blindly retry a charge or treat an open circuit as proof that no charge occurred. Use the provider's idempotency mechanisms, persist payment state, and reconcile uncertain outcomes.

A safe response might tell the customer that the payment status is being confirmed rather than falsely reporting success or failure.

### Production considerations

- Count relevant failures, not every business error. Invalid input and a declined card are not necessarily dependency-health failures.
- Do not retry indefinitely.
- Use fallback behavior only when it is semantically safe.
- Monitor circuit state changes, failure rates, latency, and rejected requests.
- Remember that each application instance may have its own breaker state.
- Test recovery behavior, not just the initial failure.

Use it when: A service depends on remote systems that can fail or become slow, and continued calls would threaten the health of your own application.

# 11. How the 10 patterns work together

Knowing individual patterns is useful. Knowing how to combine them in a real backend is much more valuable.

Consider a checkout workflow.

Message BrokerOutbox PublisherPostgreSQLPayment AdapterPayment FactoryOrder RepositoryCheckout ServiceControllerMessage BrokerOutbox PublisherPostgreSQLPayment AdapterPayment FactoryOrder RepositoryCheckout ServiceController#chatgpt-mermaid-\_r_114\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_114\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_114\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_114\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_114\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_114\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_114\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_114\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_114\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_114\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_114\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_114\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_114\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_114\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_114\_ p{margin:0;}#chatgpt-mermaid-\_r_114\_ .actor{stroke:rgb(31, 78, 148);fill:rgb(9, 23, 44);stroke-width:1;}#chatgpt-mermaid-\_r_114\_ rect.actor.outer-path[data-look="neo"]{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_114\_ rect.note[data-look="neo"]{stroke:rgb(58, 132, 63);fill:rgb(48, 48, 48);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_114\_ text.actor>tspan{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-\_r_114\_ .actor-line{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_114\_ .innerArc{stroke-width:1.5;stroke-dasharray:none;}#chatgpt-mermaid-\_r_114\_ .messageLine0{stroke-width:1.5;stroke-dasharray:none;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_114\_ .messageLine1{stroke-width:1.5;stroke-dasharray:2,2;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_114\_ [id$="-arrowhead"] path{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_114\_ .sequenceNumber{fill:#505050;}#chatgpt-mermaid-\_r_114\_ [id$="-sequencenumber"]{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_114\_ [id$="-crosshead"] path{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_114\_ .messageText{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-\_r_114\_ .labelBox{stroke:rgba(255, 255, 255, 0.15);fill:rgb(0, 0, 0);filter:none;}#chatgpt-mermaid-\_r_114\_ .labelText,#chatgpt-mermaid-\_r_114\_ .labelText>tspan{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-\_r_114\_ .loopText,#chatgpt-mermaid-\_r_114\_ .loopText>tspan{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-\_r_114\_ .sectionTitle,#chatgpt-mermaid-\_r_114\_ .sectionTitle>tspan{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-\_r_114\_ .loopLine{stroke-width:2px;stroke-dasharray:2,2;stroke:rgba(255, 255, 255, 0.15);fill:rgba(255, 255, 255, 0.15);}#chatgpt-mermaid-\_r_114\_ .note{stroke:rgb(58, 132, 63);fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_114\_ .noteText,#chatgpt-mermaid-\_r_114\_ .noteText>tspan{fill:rgb(237, 237, 237);stroke:none;font-weight:normal;}#chatgpt-mermaid-\_r_114\_ .activation0{fill:rgb(48, 48, 48);stroke:hsl(0, 0%, 8.8235294118%);}#chatgpt-mermaid-\_r_114\_ .activation1{fill:rgb(48, 48, 48);stroke:hsl(0, 0%, 8.8235294118%);}#chatgpt-mermaid-\_r_114\_ .activation2{fill:rgb(48, 48, 48);stroke:hsl(0, 0%, 8.8235294118%);}#chatgpt-mermaid-\_r_114\_ .actorPopupMenu{position:absolute;}#chatgpt-mermaid-\_r_114\_ .actorPopupMenuPanel{position:absolute;fill:rgb(9, 23, 44);box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);filter:drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4));}#chatgpt-mermaid-\_r_114\_ .actor-man circle,#chatgpt-mermaid-\_r_114\_ line{fill:rgb(9, 23, 44);stroke-width:2px;}#chatgpt-mermaid-\_r_114\_ g rect.rect{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_114\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_114\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_114\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_114\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_114\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_114\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_114\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_114\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_114\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_114\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_114\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_114\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_114\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_114\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_114\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_114\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_114\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_114\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Place orderValidate and prepare orderSelect providerPayment implementationInitiate paymentPayment resultSave order + outbox eventTransaction committedOrder responseRead pending eventsPublish OrderPlaced

This illustrates how several patterns can complement each other:

| Pattern                  | Role in the checkout system                          |
| ------------------------ | ---------------------------------------------------- |
| Repository               | Isolates order persistence                           |
| Factory                  | Selects the payment implementation                   |
| Singleton / DI lifecycle | Manages shared provider clients                      |
| Strategy                 | Applies pricing or shipping rules                    |
| Observer                 | Lets independent handlers react to events            |
| Builder                  | Constructs complex reports or request configurations |
| Adapter                  | Normalizes external payment APIs                     |
| Decorator                | Adds logging, metrics, or caching around services    |
| CQRS                     | Separates order commands from reporting queries      |
| Circuit breaker          | Limits calls to unhealthy remote dependencies        |

Important: This is not a checklist you must implement all at once. For a small checkout application, a repository, payment adapter, and well-separated business service may be enough. Add event infrastructure, CQRS, and resilience controls as your requirements justify them.

# 12. Quick comparison and decision guide

| Pattern         | Use it when…                                            | Avoid it when…                                                                |
| --------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Repository      | Database access needs a clean boundary                  | It merely duplicates every ORM method without adding value                    |
| Factory         | Object creation varies by provider or configuration     | A direct constructor call is already clear                                    |
| Singleton       | One shared instance per intended scope is appropriate   | You need isolated request state or distributed coordination                   |
| Strategy        | Algorithms or business rules vary                       | A simple conditional is easier to maintain                                    |
| Observer        | Multiple components react to an event                   | The workflow needs strict synchronous completion and a direct call is simpler |
| Builder         | Construction has many options or validation steps       | A typed object literal is sufficient                                          |
| Adapter         | External APIs differ from your internal interface       | There is no meaningful interface mismatch                                     |
| Decorator       | You need composable behavior around a component         | Simple framework middleware already solves the problem                        |
| CQRS            | Read and write requirements differ materially           | A straightforward CRUD model works well                                       |
| Circuit breaker | A failing remote dependency can threaten service health | There is no meaningful remote dependency or failure mode to protect against   |

## 13. Common mistakes backend developers make

These are important because knowing a pattern's definition does not guarantee that you are using it correctly.

1\. Overengineering from day one

Don't create 20 interfaces and factories for a simple CRUD API. Begin with clear modules and introduce abstractions when they solve real problems.

2\. Confusing patterns with frameworks

NestJS providers, middleware, interceptors, and event emitters may implement or support similar ideas. Learn the underlying design problem instead of memorizing framework-specific terminology.

3\. Ignoring transaction boundaries

A repository does not automatically make several database operations atomic. Use explicit transactions when business consistency requires them.

4\. Assuming events run exactly once

Distributed messages can be delivered more than once. Design consumers for idempotency, and use outbox-style approaches when losing an event is unacceptable.

5\. Treating a singleton as a global lock

A singleton is normally local to an application process. It does not coordinate multiple servers or containers.

6\. Adding reliability patterns without observability

A circuit breaker without metrics and useful logs makes failures harder to diagnose. Monitor dependency latency, error rates, timeouts, retries, and breaker state.

# 14. Practical learning roadmap

For a backend developer working with TypeScript and Node.js, I recommend learning these patterns in stages.

Stage 1

Code organization

Repository · Adapter · Strategy

Build an order API with PostgreSQL. Separate persistence, normalize a mock external API, and implement interchangeable shipping rules.

Goal: Testable business logic and clear boundaries.

Stage 2

Extensibility

Factory · Builder · Decorator · Singleton/DI

Add multiple payment providers, configurable reports, service logging, and appropriate dependency lifecycles.

Goal: Add features without repeatedly rewriting core code.

Stage 3

Events and architecture

Observer · CQRS

Publish order events, process email jobs asynchronously, and build a separate order-reporting query handler.

Goal: Understand asynchronous workflows and read/write separation.

Stage 4

Production reliability

Circuit breaker · Transactions · Idempotency

Simulate a slow payment provider, add timeouts and bounded retries, prevent duplicate payment processing, and test recovery.

Goal: Handle failures safely, not merely handle successful requests.

## 15. Capstone project: production-oriented e-commerce backend

Build a backend that combines these concepts in one realistic application.

[eCommerce Architecture: All You Need to Know in 2025](https://images.openai.com/static-rsc-4/VbGGoyAf-oPHmswrqvTP062GuquE6XCTu2Eys86WetCjLpPwtmnZvZ0dLj6Gi1aPLOpkucbfWvrGd7cY_kDbKPwekoVJjHAq3-yeLDpTyaap73qItw-0n_3rJF9dDUG8mT1eeWEvsMFv2HYPPmAMz4akLQRwFMpQDCP69SYo6E4?purpose=inline)

Phase A — Core API

- User authentication and product CRUD.
- Orders and order items in PostgreSQL.
- Repository interfaces and implementations.
- Integration tests for database operations.

[A Developer's Guide: How to Integrate a Payment Gateway Into a Website - DEV Community](https://images.openai.com/static-rsc-4/bTMYj4I22swlXgahkGzFPtxwgNY7HMmVxi5g7HvF-Uo6-O_ORoL64JgzbnNhUyZ_mCc8MUN2plF8B4IPu9wY5FPESnURK0U3APWLj48JugXJvJVY5FpC9T7A7RzqH4Pwzj-nxVL-fQz5AzEJziGQ4tTnOle7ocLA0x1QRlbb26Y?purpose=inline)

Phase B — Business logic

- Payment factory and provider adapters.
- Strategy-based discounts and shipping.
- Builder-based report configuration.
- Dependency injection and structured logging.

[Architecture of Scale: Processing 10M+ Daily Component Offers with Event-Driven Microservices](https://images.openai.com/static-rsc-4/RhL4Hjhg2AaX8tiOECxeXlyN3yAeOZEHxDajSTO-soKF9Q6X1LjjuRjnKurbYbyzwmrn0MsxvxNCC_hWn0UletHUo8iUHSkUR62LHLMsSe0A9K9cmneH0y6ZyasfMQAl-NwnNcBwBq-th85ysAndfNj2P3rvT6-kPqjuSSUbk0o?purpose=inline)

Phase C — Asynchronous processing

- Order events and background email jobs.
- RabbitMQ or another suitable broker.
- Transactional outbox and idempotent consumers.
- Separate query handlers for reporting.

[DLC IT Solutions Consulting Ltd — IT Consultancy & Software Development, Kidderminster](https://images.openai.com/static-rsc-4/Uf7fBrH56bjmGjwZcOhZAT5rYe8_Ob0WbGMe5jA85W6Cj539YaNfSoC6EzcqanVJCwXp8V0b-3zzDszCQGMvAAvbpyXqFCeYajkjCQgLIWCJXcURihnvbfvWlJnVEXcC-xZabNNnItFkfyyn_JqQsilaa1riEKve-cHE9ETmZ64?purpose=inline)

Phase D — Production readiness

- Timeouts, circuit breakers, and bounded retries.
- Metrics, structured logs, and distributed tracing.
- Load testing, health checks, and graceful shutdown.
- Tests for concurrent orders and payment failures.

### Suggested stack

- Runtime: Node.js + TypeScript
- Framework: ExpressJS
- Database: PostgreSQL + Prisma
- Cache: Redis, when useful
- Messaging: BullMQ
- Testing: Jest and Supertest
- Observability: OpenTelemetry-compatible tracing and metrics
- Deployment: Docker

You don't need to introduce every technology immediately. Start with one deployable backend and add infrastructure as you reach the relevant learning stage.

## 16. Test your understanding

1\. You need to support Stripe and Razorpay without spreading provider construction logic across services. Which pattern helps?

Repository

Factory

Observer

Circuit breaker

2\. Your application needs different shipping-cost algorithms for domestic and international deliveries. Which pattern fits?

Strategy

Singleton

Builder

CQRS

3\. A saved order must reliably trigger asynchronous downstream processing even if the application crashes. What is a strong starting point?

A singleton event bus

A builder

Transactional outbox and durable messaging

A cache decorator

4\. Five application instances each have their own singleton. Can those instances use it as a globally shared lock?

Yes, singletons are global

No, not without shared coordination

Only with TypeScript

Yes, if they use PostgreSQL

5\. An external payment API is timing out repeatedly. Which pattern can stop repeated calls while it recovers?

Adapter

Repository

Builder

Circuit breaker

Check answers

## Final takeaway

You do not become a strong backend developer by memorizing ten definitions. You become stronger by recognizing when a component has too many responsibilities, when an integration is leaking into business logic, when an event can be lost, and when one failing dependency can destabilize the whole service.

Learn Repository, Adapter, and Strategy first. Then practice Factory, Dependency Injection, Builder, and Decorator. Move to Observer and CQRS when the application needs those architectural boundaries. Finally, learn Circuit Breaker alongside timeouts, retries, idempotency, and observability.

That progression builds both clean code and the production engineering judgment needed to maintain reliable backend systems.

I can also create an architecture diagram showing how all 10 patterns fit together in a real backend application.