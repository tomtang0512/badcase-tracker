# 食安售后 Bad Case 记录台

纯静态 Web 小工具（无后端、无依赖、免构建），用于食安售后负面事件的记录与量化：逐单录入 + 自动统计看板，替代 Excel 记录表。

## 功能

- **录入/编辑**：发生日期、投诉类型、定性（真实客诉/疑似碰瓷/待定）、四维归因（人/物料/环境/操作/物料上游）、留档证据、处理结果、退款/赔付/挽回金额、订单号、是否差评、备注，全部下拉打标签
- **看板**：核心指标（总单数、客诉分类、退款/赔付总额、单真实客诉成本、挽回金额、差评数）、防碰瓷自证专项（自证成功率、避免损失金额、无留档客诉数）、按月趋势、投诉类型/归因/处理结果分布
- **数据**：存浏览器 localStorage；导出 JSON 备份 / 导入恢复；导出 CSV 可用 Excel 打开
- 手机浏览器可用

## 部署到 GitHub Pages

### 方式一：网页拖拽上传（无需安装 git）

1. 登录 GitHub，新建仓库（Public），名称如 `badcase-tracker`，不要勾选任何初始化文件（README/license/.gitignore 都不勾）
2. 进入空仓库页，点 **uploading an existing file**（或 Add file → Upload files）
3. 把本目录下的所有内容（`index.html`、`css/`、`js/`、`.nojekyll`、本 README）**整体拖进上传区域**，等文件列表出现后点 **Commit changes**
   - 直接拖文件夹即可，目录结构会自动保留；`.nojekyll` 是隐藏文件，若拖不进去可在仓库页 Add file → Create new file，文件名填 `.nojekyll`，内容留空提交
4. 仓库页 → Settings → Pages → Source 选 `Deploy from a branch`，Branch 选 `main` / `(root)`，Save
5. 约 1 分钟后访问 `https://tomtang0512.github.io/badcase-tracker/` 即可使用

### 方式二：git 命令行
1. 在 GitHub 新建一个仓库（Public），如 `badcase-tracker`
2. 把本目录下所有文件（`index.html`、`css/`、`js/`、`.nojekyll`、本 README）上传到仓库 main 分支根目录：

```bash
cd badcase-tracker
git init
git add .
git commit -m "init: 食安售后bad case记录台"
git branch -M main
git remote add origin https://github.com/<你的用户名>/badcase-tracker.git
git push -u origin main
```

3. 仓库页 → Settings → Pages → Source 选 `Deploy from a branch`，Branch 选 `main` / `(root)`，Save
4. 约 1 分钟后访问 `https://<你的用户名>.github.io/badcase-tracker/` 即可使用

## 本地使用

必须通过 HTTP 访问（直接双击 index.html 无法运行），任选其一：

```bash
# 方式一：Python
python -m http.server 8000
# 然后浏览器打开 http://localhost:8000

# 方式二：VS Code 装 Live Server 插件后右键 index.html → Open with Live Server
```

## 数据说明

- 数据只存在**当前设备、当前浏览器**的 localStorage 里，不上传任何服务器
- 换电脑/换浏览器/清除浏览器数据前，务必先「导出JSON」，到新设备再「导入」
- 首次使用可点「示例数据」了解各字段与看板效果，正式使用前「清空」即可
