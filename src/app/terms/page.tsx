// src/app/terms/page.tsx
"use client";

import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { LANGS, type LangKey } from "@/lib/langs";
// ※ あなたの環境にある想定のUI言語フック（未導入でもビルドは通ります）
import { useUILang } from "@/lib/atoms/uiLangAtom";

/* ===== 型 ===== */
type SiteSettings = {
  siteKey?: string;
  siteName?: string; // 店名
  ownerName?: string; // 代表者
  ownerAddress?: string; // 所在地
  ownerEmail?: string; // 連絡先メール
  ownerPhone?: string; // 連絡先電話
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
};

/* ===== 簡易 i18n（全16言語対応）===== */
const I18N: Record<LangKey, Record<string, string>> = {
  ja: {
    h1: "利用規約（購入規約）",
    lastUpdated: "最終更新日：{date}",
    loading: "読み込み中です…",
    intro:
      "本利用規約（以下「本規約」）は、{siteName}（以下「当店」）が提供するオンラインストア（以下「本サービス」）における商品の購入・利用条件を定めるものです。本サービスを閲覧・購入された時点で、本規約に同意いただいたものとみなします。",
    s1: "1. 事業者情報",
    s1_business: "事業者名：{siteName}",
    s1_rep: "代表者：{ownerName}",
    s1_addr: "所在地：{ownerAddress}",
    s1_contact:
      "連絡先：{ownerEmail} ／ {ownerPhone}（受付時間：平日10:00–17:00 目安）",
    s1_related: "関連ポリシー：",
    s1_refund: "返品・返金ポリシー",
    s1_privacy: "プライバシーポリシー",
    s1_tokushoho: "特定商取引法に基づく表記",
    s2: "2. ご注文・契約の成立",
    s2_1: "ご注文完了画面の表示または注文確認メールの送信をもって、売買契約が成立します。",
    s2_2: "重複注文・不正の疑い・長期欠品・配送不能等が判明した場合、成立後でもご注文を取消すことがあります。",
    s3: "3. 価格・通貨・決済",
    s3_1: "商品価格はサイトの表示に従います（原則税込）。",
    s3_2: "決済は Stripe 社の代行サービスを利用します。",
    s3_3: "決済通貨は原則日本円（JPY）です。表示上の他通貨換算は参考値であり、最終請求額はカード会社レート等により変動します。",
    s4: "4. 配送・通関・輸入税",
    s4_1: "配送対象地域：国内およびショップが別途指定した海外地域。",
    s4_2: "国際配送では、関税・輸入税・通関手数料等は受取人のご負担となるのが原則です。",
    s4_3: "住所不備・保管期限切れ・受取拒否・通関未対応等による返送時は、往復送料・手数料をご負担いただく場合があります。",
    s5: "5. 送料・無料条件",
    s5_p: "送料はチェックアウト時に表示します。一定金額以上の送料無料条件が設定されている場合は、カート表示に従います。",
    s6: "6. 返品・交換・キャンセル",
    s6_1: "条件は 返品・返金ポリシー に定めます。",
    s6_2: "通信販売には原則クーリング・オフ制度は適用されません。",
    s6_3: "出荷後の注文内容変更・キャンセルはお受けできない場合があります。",
    s7: "7. 製品情報・在庫",
    s7_1: "画像・説明は実物と色味等が若干異なる場合があります。",
    s7_2: "在庫は随時変動し、カート投入時点では確保されません。欠品時は返金または代替提案を行います。",
    s8: "8. 禁止事項",
    s8_p: "法令違反、転売目的の大量購入、不正アクセス、輸出入規制に抵触する行為等を禁止します。",
    s9: "9. 知的財産",
    s9_p: "本サービス上のコンテンツの権利は当店または正当な権利者に帰属し、無断複製・転載を禁止します。",
    s10: "10. 免責",
    s10_1:
      "天災・通関/輸送遅延・通信障害・プラットフォーム/決済障害等、当店の合理的支配を超える事由に起因する損害については責任を負いません。",
    s10_2:
      "当店の故意または重過失による場合を除き、当店の責任はお客様が当該商品に支払った金額を上限とします。",
    s11: "11. 個人情報の取扱い",
    s11_p:
      "個人情報は プライバシーポリシー に従い取扱います。カード情報は Stripe 社により安全に処理され、当店は保持しません。",
    s12: "12. 未成年者の利用",
    s12_p:
      "未成年者は保護者の同意を得た上でご利用ください。無断利用が判明した場合、注文を取消すことがあります。",
    s13: "13. 規約の変更",
    s13_p:
      "必要に応じて本規約を改定します。改定後は本サービス上に表示した時点で効力を生じます。",
    s14: "14. 準拠法・裁判管轄",
    s14_p:
      "本規約は日本法に準拠し、紛争は【大阪地方裁判所】を第一審の専属的合意管轄とします。",
    s15: "15. 言語",
    s15_p: "翻訳版が作成される場合、日本語版を正本とします。",
    link_refund: "返品・返金ポリシー",
    link_privacy: "プライバシーポリシー",
    link_tokushoho: "特定商取引法に基づく表記",
    ogTitle: "利用規約（購入規約）｜{siteName}",
    ogDesc: "{siteName}のオンライン購入に関する利用規約（購入規約）です。",
  },

  en: {
    h1: "Terms of Purchase",
    lastUpdated: "Last updated: {date}",
    loading: "Loading…",
    intro:
      "These Terms (the “Terms”) set forth the conditions for purchasing and using the online store (the “Service”) provided by {siteName} (the “Store”). By viewing or purchasing via the Service, you are deemed to have agreed to the Terms.",
    s1: "1. Business Information",
    s1_business: "Business name: {siteName}",
    s1_rep: "Representative: {ownerName}",
    s1_addr: "Address: {ownerAddress}",
    s1_contact:
      "Contact: {ownerEmail} / {ownerPhone} (Hours: Weekdays 10:00–17:00 JST, guideline)",
    s1_related: "Related policies:",
    s1_refund: "Refund & Return Policy",
    s1_privacy: "Privacy Policy",
    s1_tokushoho: "Legal Notice (Specified Commercial Transactions Act)",
    s2: "2. Orders & Contract Formation",
    s2_1: "A sales contract is formed upon display of the order-complete screen or upon sending an order confirmation email.",
    s2_2: "Even after formation, we may cancel an order in cases such as duplicate orders, suspected fraud, prolonged stock-outs, or inability to ship.",
    s3: "3. Pricing, Currency & Payment",
    s3_1: "Product prices follow the site display (tax-included in principle).",
    s3_2: "Payments are processed by Stripe.",
    s3_3: "The settlement currency is JPY in principle. Any other currency shown is for reference; the final billed amount depends on your card issuer’s rate, etc.",
    s4: "4. Shipping, Customs & Import Taxes",
    s4_1: "Shipping areas: Japan and any overseas regions designated by the shop.",
    s4_2: "For international shipments, customs duties, import taxes, and brokerage fees are borne by the recipient in principle.",
    s4_3: "If a parcel is returned due to address errors, storage expiry, refusal of receipt, or customs issues, round-trip shipping and fees may be charged.",
    s5: "5. Shipping Fees & Free-Shipping Thresholds",
    s5_p: "Shipping fees are shown at checkout. If a free-shipping threshold is configured, the cart display takes precedence.",
    s6: "6. Returns, Exchanges & Cancellations",
    s6_1: "See the Refund & Return Policy for detailed conditions.",
    s6_2: "Cooling-off does not generally apply to distance sales.",
    s6_3: "After dispatch, changes or cancellations may not be accepted.",
    s7: "7. Product Information & Stock",
    s7_1: "Images and descriptions may differ slightly from the actual product (e.g., in color).",
    s7_2: "Stock fluctuates in real time and is not secured at the time of adding to cart. In case of shortage, we will refund or propose an alternative.",
    s8: "8. Prohibited Acts",
    s8_p: "Acts that violate laws and regulations, large-quantity purchases for resale, unauthorized access, and acts that breach export/import controls are prohibited.",
    s9: "9. Intellectual Property",
    s9_p: "Rights to content on the Service belong to the Store or rightful owners. Unauthorized reproduction or reprint is prohibited.",
    s10: "10. Disclaimers",
    s10_1:
      "We are not liable for damages caused by force majeure or reasons beyond our reasonable control (e.g., disasters, customs/shipping delays, network outages, platform/payment failures).",
    s10_2:
      "Except for willful misconduct or gross negligence, our liability shall be limited to the amount you paid for the product.",
    s11: "11. Personal Data",
    s11_p:
      "Personal data is handled in accordance with the Privacy Policy. Card data is securely processed by Stripe and is not retained by us.",
    s12: "12. Use by Minors",
    s12_p:
      "Minors must obtain consent from a guardian. Orders may be cancelled if unauthorized use is found.",
    s13: "13. Changes to the Terms",
    s13_p:
      "We may revise these Terms as necessary. Revisions take effect when posted on the Service.",
    s14: "14. Governing Law & Jurisdiction",
    s14_p:
      "These Terms are governed by the laws of Japan. Disputes shall be subject to the exclusive jurisdiction of the Osaka District Court in the first instance.",
    s15: "15. Language",
    s15_p:
      "If translations are prepared, the Japanese version shall prevail as the official text.",
    link_refund: "Refund & Return Policy",
    link_privacy: "Privacy Policy",
    link_tokushoho: "Legal Notice",
    ogTitle: "Terms of Purchase | {siteName}",
    ogDesc: "Terms governing online purchases from {siteName}.",
  },

  zh: {
    h1: "购买条款",
    lastUpdated: "最后更新：{date}",
    loading: "加载中…",
    intro:
      "本购买条款（“本条款”）规定了{siteName}（“本店”）提供的在线商店（“本服务”）的购买与使用条件。您浏览或购买即视为同意本条款。",
    s1: "1. 经营者信息",
    s1_business: "经营者名称：{siteName}",
    s1_rep: "负责人：{ownerName}",
    s1_addr: "地址：{ownerAddress}",
    s1_contact:
      "联系方式：{ownerEmail} / {ownerPhone}（受理时间：工作日10:00–17:00）",
    s1_related: "相关政策：",
    s1_refund: "退换货政策",
    s1_privacy: "隐私政策",
    s1_tokushoho: "特定商取引法标示",
    s2: "2. 订单与合同成立",
    s2_1: "当显示下单完成页面或发送订单确认邮件时，买卖合同成立。",
    s2_2: "即使合同已成立，如发现重复下单、涉嫌欺诈、长期缺货或无法配送等情形，亦可能取消订单。",
    s3: "3. 价格、货币与支付",
    s3_1: "商品价格以网站显示为准（原则上含税）。",
    s3_2: "支付由 Stripe 代为处理。",
    s3_3: "结算货币原则上为日元（JPY）。其他货币显示仅供参考，最终金额取决于发卡行汇率等。",
    s4: "4. 配送、清关与进口税费",
    s4_1: "配送区域：日本国内及店铺另行指定的海外地区。",
    s4_2: "国际配送原则上由收件人承担关税、进口税及代理手续费等。",
    s4_3: "因地址错误、保管期届满、拒收或清关问题导致退回时，可能收取往返运费及相关费用。",
    s5: "5. 运费与包邮门槛",
    s5_p: "运费以结算页显示为准。如设置包邮门槛，以购物车显示为准。",
    s6: "6. 退换与取消",
    s6_1: "详细条件见 退换货政策。",
    s6_2: "远程销售通常不适用冷静期制度。",
    s6_3: "发货后可能无法变更或取消订单。",
    s7: "7. 产品信息与库存",
    s7_1: "图片与说明可能与实物略有差异（如颜色）。",
    s7_2: "库存实时变化，加入购物车时并不视为保留。缺货将退款或提供替代方案。",
    s8: "8. 禁止事项",
    s8_p: "禁止违法行为、大量囤货转售、未经授权的访问以及违反进出口管制的行为。",
    s9: "9. 知识产权",
    s9_p: "本服务上的内容版权归本店或合法权利人所有，禁止未经许可的复制与转载。",
    s10: "10. 免责声明",
    s10_1:
      "对不可抗力或非本店合理控制范围内的原因（如灾害、清关/运输延误、网络中断、平台/支付故障）造成的损失，本店不承担责任。",
    s10_2: "除非因本店故意或重大过失，责任以您就该商品支付的金额为上限。",
    s11: "11. 个人信息",
    s11_p:
      "个人信息按照 隐私政策 处理。卡信息由 Stripe 安全处理，本店不予保留。",
    s12: "12. 未成年人使用",
    s12_p: "未成年人需经监护人同意使用。如发现未经授权使用，可能取消订单。",
    s13: "13. 条款变更",
    s13_p: "本条款可能视需要进行修订，修订后在本服务发布之时生效。",
    s14: "14. 适用法律与管辖",
    s14_p:
      "本条款受日本法律管辖，争议由大阪地方法院作为第一审专属合意管辖法院。",
    s15: "15. 语言",
    s15_p: "如制作有翻译版本，以日文版本为准。",
    link_refund: "退换货政策",
    link_privacy: "隐私政策",
    link_tokushoho: "特定商取引法标示",
    ogTitle: "购买条款｜{siteName}",
    ogDesc: "有关在 {siteName} 在线购买的条款说明。",
  },

  "zh-TW": {
    h1: "購買條款",
    lastUpdated: "最後更新：{date}",
    loading: "載入中…",

    intro:
      "本購買條款（下稱「本條款」）係為規範由 {siteName}（下稱「本店」）所提供之線上商店（下稱「本服務」）之商品購買與使用條件。當您瀏覽或於本服務購買時，即視為同意本條款。",

    s1: "1. 業者資訊",
    s1_business: "業者名稱：{siteName}",
    s1_rep: "負責人：{ownerName}",
    s1_addr: "地址：{ownerAddress}",
    s1_contact:
      "聯絡方式：{ownerEmail} ／ {ownerPhone}（受理時間：週一至週五 10:00–17:00，供參考）",
    s1_related: "相關政策：",
    s1_refund: "退貨與退款政策",
    s1_privacy: "隱私權政策",
    s1_tokushoho: "依特定商取引法之標示",

    s2: "2. 下單與契約成立",
    s2_1: "當訂單完成頁面顯示或訂單確認電子郵件寄出時，買賣契約即告成立。",
    s2_2: "即便契約已成立，如發現重複下單、疑似不正、長期缺貨、無法配送等情形，訂單可能被取消。",

    s3: "3. 價格、幣別與付款",
    s3_1: "商品價格以網站標示為準（原則上為含稅）。",
    s3_2: "付款由 Stripe 代為處理。",
    s3_3: "結算幣別原則上為日圓（JPY）。頁面顯示之他幣換算僅供參考，最終請款金額以發卡行匯率等為準。",

    s4: "4. 配送、通關與進口稅費",
    s4_1: "配送地區：日本境內及本店另行指定之海外地區。",
    s4_2: "國際配送之關稅、進口稅、通關手續費等，原則上由收件人負擔。",
    s4_3: "因地址不完整、保管期限屆滿、拒收、通關未處理等原因致退回時，可能需負擔往返運費與相關費用。",

    s5: "5. 運費與免運門檻",
    s5_p: "運費將於結帳時顯示。若設定免運門檻，則以購物車顯示為準。",

    s6: "6. 退換貨與取消",
    s6_1: "詳細條件請參考「退貨與退款政策」。",
    s6_2: "一般而言，遠距銷售不適用冷靜期制度。",
    s6_3: "出貨後之訂單變更或取消，可能無法受理。",

    s7: "7. 商品資訊與庫存",
    s7_1: "實品與圖片、說明之色澤等可能略有差異。",
    s7_2: "庫存即時變動，加入購物車時不保證保留；如遇缺貨，將退款或提供替代方案。",

    s8: "8. 禁止行為",
    s8_p: "禁止違反法令、以轉售為目的之大量購買、未經授權之存取、以及違反輸出入管制之行為。",

    s9: "9. 智慧財產權",
    s9_p: "本服務之內容權利屬本店或合法權利人所有，未經許可禁止複製、轉載。",

    s10: "10. 免責事項",
    s10_1:
      "因不可抗力或非本店合理可控制之事由（如天災、通關/運輸延遲、通訊障礙、平台/金流障礙等）所致損害，本店不負責任。",
    s10_2:
      "除本店故意或重大過失外，本店之賠償責任以上述商品之實際支付金額為上限。",

    s11: "11. 個人資料之處理",
    s11_p:
      "個人資料依「隱私權政策」處理。卡號等支付資訊由 Stripe 安全處理，本店不予保存。",

    s12: "12. 未成年人使用",
    s12_p:
      "未成年人須取得法定代理人同意後方得使用。若發現未經同意之使用，訂單可能被取消。",

    s13: "13. 條款之變更",
    s13_p: "本店得視需要修訂本條款；修訂後自於本服務公布時起生效。",

    s14: "14. 準據法與管轄法院",
    s14_p:
      "本條款以日本法為準據法，爭議以【大阪地方裁判所】為第一審專屬合意管轄法院。",

    s15: "15. 語言",
    s15_p: "如備有譯本，以日文版為正本。",

    link_refund: "退貨與退款政策",
    link_privacy: "隱私權政策",
    link_tokushoho: "依特定商取引法之標示",

    ogTitle: "購買條款｜{siteName}",
    ogDesc: "關於 {siteName} 線上購買之條款說明。",
  },

  ko: {
    h1: "구매 약관",
    lastUpdated: "최종 업데이트: {date}",
    loading: "로딩 중…",
    intro:
      "본 구매 약관(이하 ‘약관’)은 {siteName}(이하 ‘당사’)가 제공하는 온라인 스토어(이하 ‘서비스’)에서의 구매 및 이용 조건을 정합니다. 서비스를 열람하거나 구매함으로써 본 약관에 동의한 것으로 간주됩니다.",
    s1: "1. 사업자 정보",
    s1_business: "사업자명: {siteName}",
    s1_rep: "대표자: {ownerName}",
    s1_addr: "주소: {ownerAddress}",
    s1_contact: "연락처: {ownerEmail} / {ownerPhone} (평일 10:00–17:00, 기준)",
    s1_related: "관련 정책:",
    s1_refund: "반품/환불 정책",
    s1_privacy: "개인정보 처리방침",
    s1_tokushoho: "특정상거래법 고지",
    s2: "2. 주문 및 계약 성립",
    s2_1: "주문 완료 화면이 표시되거나 주문 확인 이메일이 발송되면 매매계약이 성립합니다.",
    s2_2: "계약 성립 후에도 중복 주문, 사기 의심, 장기 품절, 배송 불가 등 사유가 있는 경우 주문이 취소될 수 있습니다.",
    s3: "3. 가격, 통화 및 결제",
    s3_1: "상품 가격은 사이트 표시를 따릅니다(원칙적으로 부가세 포함).",
    s3_2: "결제는 Stripe를 통해 처리됩니다.",
    s3_3: "결제 통화는 원칙적으로 JPY(엔)입니다. 다른 통화 표시는 참고용이며, 최종 청구액은 카드사 환율 등에 따라 달라질 수 있습니다.",
    s4: "4. 배송, 통관 및 수입세",
    s4_1: "배송 지역: 일본 국내 및 상점이 지정한 해외 지역.",
    s4_2: "국제 배송의 경우, 관세∙수입세∙통관 수수료 등은 원칙적으로 수취인이 부담합니다.",
    s4_3: "주소 오류, 보관기간 만료, 수취 거부, 통관 문제 등으로 반송되는 경우 왕복 배송비 및 수수료가 청구될 수 있습니다.",
    s5: "5. 배송비 및 무료 배송 기준",
    s5_p: "배송비는 결제 과정에서 표시됩니다. 무료 배송 기준이 설정된 경우 장바구니 표시가 우선합니다.",
    s6: "6. 반품, 교환 및 취소",
    s6_1: "자세한 조건은 반품/환불 정책을 참조하세요.",
    s6_2: "통신판매에는 일반적으로 청약철회 제도가 적용되지 않습니다.",
    s6_3: "발송 후에는 주문 변경이나 취소가 불가할 수 있습니다.",
    s7: "7. 제품 정보 및 재고",
    s7_1: "이미지 및 설명은 실제 제품과(색상 등) 다소 차이가 있을 수 있습니다.",
    s7_2: "재고는 수시로 변동되며 장바구니에 담았다고 확보되는 것은 아닙니다. 품절 시 환불하거나 대안을 제시합니다.",
    s8: "8. 금지 행위",
    s8_p: "법령 위반, 대량 구매를 통한 재판매, 무단 접속, 수출입 규제 위반 행위 등을 금지합니다.",
    s9: "9. 지식재산권",
    s9_p: "서비스의 콘텐츠 권리는 당사 또는 정당한 권리자에게 있으며, 무단 복제∙전재를 금지합니다.",
    s10: "10. 면책",
    s10_1:
      "천재지변, 통관/운송 지연, 통신 장애, 플랫폼/결제 장애 등 당사의 합리적 통제를 벗어난 사유로 인한 손해에 대해서는 책임을 지지 않습니다.",
    s10_2:
      "당사의 고의 또는 중과실을 제외하고는, 책임 한도는 고객이 해당 상품에 지불한 금액을 상한으로 합니다.",
    s11: "11. 개인정보",
    s11_p:
      "개인정보는 개인정보 처리방침에 따라 취급합니다. 카드 정보는 Stripe에서 안전하게 처리하며, 당사는 보관하지 않습니다.",
    s12: "12. 미성년자 이용",
    s12_p:
      "미성년자는 보호자의 동의를 얻어 이용해야 합니다. 무단 이용이 확인될 경우 주문이 취소될 수 있습니다.",
    s13: "13. 약관 변경",
    s13_p:
      "필요 시 본 약관을 개정할 수 있으며, 개정 후 서비스에 게시한 때부터 효력이 발생합니다.",
    s14: "14. 준거법 및 관할",
    s14_p:
      "본 약관은 일본법을 준거법으로 하며, 분쟁은 오사카 지방재판소를 제1심 전속 관할로 합니다.",
    s15: "15. 언어",
    s15_p: "번역본이 있는 경우 일본어판을 정본으로 합니다.",
    link_refund: "반품/환불 정책",
    link_privacy: "개인정보 처리방침",
    link_tokushoho: "특정상거래법 고지",
    ogTitle: "구매 약관 | {siteName}",
    ogDesc: "{siteName} 온라인 구매에 관한 약관 안내.",
  },

  fr: {
    h1: "Conditions d’achat",
    lastUpdated: "Dernière mise à jour : {date}",
    loading: "Chargement…",
    intro:
      "Les présentes conditions (les « Conditions ») définissent les modalités d’achat et d’utilisation de la boutique en ligne (le « Service ») fournie par {siteName} (la « Boutique »). En consultant ou en achetant via le Service, vous acceptez les Conditions.",
    s1: "1. Informations sur l’entreprise",
    s1_business: "Nom de l’entreprise : {siteName}",
    s1_rep: "Représentant : {ownerName}",
    s1_addr: "Adresse : {ownerAddress}",
    s1_contact:
      "Contact : {ownerEmail} / {ownerPhone} (heures : du lundi au vendredi 10h–17h JST, indicatif)",
    s1_related: "Politiques associées :",
    s1_refund: "Politique de retours et remboursements",
    s1_privacy: "Politique de confidentialité",
    s1_tokushoho:
      "Mentions légales (loi japonaise sur les transactions spécifiques)",
    s2: "2. Commandes et formation du contrat",
    s2_1: "Le contrat de vente est conclu à l’affichage de l’écran de confirmation de commande ou à l’envoi de l’e-mail de confirmation.",
    s2_2: "Même après la conclusion, nous pouvons annuler une commande en cas de doublon, suspicion de fraude, rupture prolongée ou impossibilité d’expédition.",
    s3: "3. Tarifs, devise et paiement",
    s3_1: "Les prix suivent l’affichage sur le site (TTC en principe).",
    s3_2: "Les paiements sont traités par Stripe.",
    s3_3: "La devise de règlement est le JPY en principe. Les autres devises affichées sont indicatives ; le montant final dépend du taux de votre émetteur.",
    s4: "4. Expédition, douanes et taxes d’importation",
    s4_1: "Zones d’expédition : Japon et régions à l’étranger désignées par la Boutique.",
    s4_2: "Pour l’international, droits de douane, taxes d’import et frais de courtage sont à la charge du destinataire.",
    s4_3: "En cas de retour pour adresse erronée, délai de garde expiré, refus de réception ou problème douanier, des frais aller-retour peuvent s’appliquer.",
    s5: "5. Frais d’expédition et seuil de gratuité",
    s5_p: "Les frais d’expédition sont affichés au paiement. En cas de seuil de gratuité, l’affichage du panier prévaut.",
    s6: "6. Retours, échanges et annulations",
    s6_1: "Voir la Politique de retours et remboursements pour les détails.",
    s6_2: "Le droit de rétractation est en général inapplicable aux ventes à distance au Japon.",
    s6_3: "Après l’expédition, les modifications ou annulations peuvent être refusées.",
    s7: "7. Informations sur les produits et stock",
    s7_1: "Les images et descriptions peuvent légèrement différer du produit réel (p. ex. couleur).",
    s7_2: "Le stock varie en temps réel et n’est pas garanti lors de l’ajout au panier. En cas de rupture, remboursement ou alternative sera proposé.",
    s8: "8. Actes interdits",
    s8_p: "Sont interdits : infractions aux lois, achats en quantité pour revente, accès non autorisé, violations des contrôles export/import.",
    s9: "9. Propriété intellectuelle",
    s9_p: "Les contenus du Service appartiennent à la Boutique ou aux titulaires de droits. Toute reproduction non autorisée est interdite.",
    s10: "10. Clause de non-responsabilité",
    s10_1:
      "Nous déclinons toute responsabilité en cas de force majeure ou de causes hors de notre contrôle raisonnable (catastrophes, retards douaniers/transport, pannes réseau, défaillance plateforme/paiement).",
    s10_2:
      "Sauf faute intentionnelle ou lourde, notre responsabilité est limitée au montant payé pour le produit.",
    s11: "11. Données personnelles",
    s11_p:
      "Les données personnelles sont traitées conformément à la Politique de confidentialité. Les données de carte sont gérées par Stripe ; nous ne les conservons pas.",
    s12: "12. Mineurs",
    s12_p:
      "Les mineurs doivent obtenir l’autorisation d’un représentant légal. En cas d’utilisation non autorisée, la commande peut être annulée.",
    s13: "13. Modifications des Conditions",
    s13_p:
      "Nous pouvons réviser les Conditions si nécessaire. Elles prennent effet dès leur publication sur le Service.",
    s14: "14. Droit applicable et juridiction",
    s14_p:
      "Les Conditions sont régies par le droit japonais. Tout litige relève de la compétence exclusive du tribunal de district d’Osaka en première instance.",
    s15: "15. Langue",
    s15_p: "En cas de traduction, la version japonaise prévaut.",
    link_refund: "Politique de retours et remboursements",
    link_privacy: "Politique de confidentialité",
    link_tokushoho: "Mentions légales",
    ogTitle: "Conditions d’achat | {siteName}",
    ogDesc: "Conditions applicables aux achats en ligne sur {siteName}.",
  },

  es: {
    h1: "Términos de compra",
    lastUpdated: "Última actualización: {date}",
    loading: "Cargando…",
    intro:
      "Estos Términos establecen las condiciones para comprar y usar la tienda en línea (el «Servicio») proporcionada por {siteName} (la «Tienda»). Al navegar o comprar en el Servicio, se entiende que acepta los Términos.",
    s1: "1. Información del negocio",
    s1_business: "Nombre del negocio: {siteName}",
    s1_rep: "Representante: {ownerName}",
    s1_addr: "Dirección: {ownerAddress}",
    s1_contact:
      "Contacto: {ownerEmail} / {ownerPhone} (Horario: lunes a viernes 10:00–17:00 JST, orientativo)",
    s1_related: "Políticas relacionadas:",
    s1_refund: "Política de devoluciones y reembolsos",
    s1_privacy: "Política de privacidad",
    s1_tokushoho:
      "Aviso legal (Ley de Transacciones Comerciales Específicas de Japón)",
    s2: "2. Pedidos y formación del contrato",
    s2_1: "El contrato de compraventa se forma al mostrar la pantalla de pedido completado o al enviar el correo de confirmación.",
    s2_2: "Incluso tras la formación, podemos cancelar un pedido por duplicidades, sospecha de fraude, falta prolongada de stock o imposibilidad de envío.",
    s3: "3. Precios, moneda y pago",
    s3_1: "Los precios se ajustan a lo mostrado en el sitio (en principio, con impuestos incluidos).",
    s3_2: "Los pagos se procesan con Stripe.",
    s3_3: "La divisa de liquidación es, en principio, JPY. Otras divisas mostradas son orientativas; el importe final depende del emisor de la tarjeta.",
    s4: "4. Envíos, aduanas e impuestos de importación",
    s4_1: "Zonas de envío: Japón y regiones en el extranjero designadas por la tienda.",
    s4_2: "En envíos internacionales, los aranceles, impuestos y tasas de gestión corren, en principio, a cargo del destinatario.",
    s4_3: "Si un paquete se devuelve por dirección errónea, vencimiento de almacenamiento, rechazo de recepción o incidencias aduaneras, se podrán cobrar gastos de envío de ida y vuelta y tasas.",
    s5: "5. Gastos de envío y umbral de envío gratuito",
    s5_p: "Los gastos se muestran en el checkout. Si hay umbral de envío gratuito, prevalece lo mostrado en el carrito.",
    s6: "6. Devoluciones, cambios y cancelaciones",
    s6_1: "Consulte la Política de devoluciones y reembolsos para los detalles.",
    s6_2: "En las ventas a distancia en Japón, generalmente no aplica derecho de desistimiento.",
    s6_3: "Tras el envío, puede que no se acepten cambios o cancelaciones.",
    s7: "7. Información del producto y stock",
    s7_1: "Las imágenes y descripciones pueden diferir ligeramente del producto real (p. ej., en color).",
    s7_2: "El stock varía en tiempo real y no se garantiza al añadir al carrito. En caso de falta, reembolsaremos o propondremos alternativa.",
    s8: "8. Actos prohibidos",
    s8_p: "Se prohíben actos que violen las leyes, compras masivas para reventa, accesos no autorizados y actos que infrinjan controles de exportación/importación.",
    s9: "9. Propiedad intelectual",
    s9_p: "Los contenidos del Servicio pertenecen a la Tienda o a sus legítimos titulares. Prohibida su reproducción no autorizada.",
    s10: "10. Exención de responsabilidad",
    s10_1:
      "No somos responsables de daños causados por fuerza mayor o razones fuera de nuestro control (desastres, retrasos aduaneros/de transporte, fallos de red, de plataforma/pago).",
    s10_2:
      "Salvo dolo o negligencia grave, la responsabilidad se limita al importe pagado por el producto.",
    s11: "11. Datos personales",
    s11_p:
      "Los datos personales se tratan conforme a la Política de privacidad. Los datos de tarjeta los gestiona Stripe; no los conservamos.",
    s12: "12. Uso por menores",
    s12_p:
      "Los menores deben contar con consentimiento de su tutor. Se podrá cancelar el pedido en caso de uso no autorizado.",
    s13: "13. Cambios en los Términos",
    s13_p:
      "Podemos revisarlos cuando sea necesario. Surten efecto al publicarse en el Servicio.",
    s14: "14. Ley aplicable y jurisdicción",
    s14_p:
      "Se rigen por la ley japonesa. Controversias: competencia exclusiva del Tribunal de Distrito de Osaka en primera instancia.",
    s15: "15. Idioma",
    s15_p: "En caso de traducción, prevalece la versión en japonés.",
    link_refund: "Política de devoluciones y reembolsos",
    link_privacy: "Política de privacidad",
    link_tokushoho: "Aviso legal",
    ogTitle: "Términos de compra | {siteName}",
    ogDesc: "Términos que rigen las compras en línea en {siteName}.",
  },

  de: {
    h1: "Kaufbedingungen",
    lastUpdated: "Zuletzt aktualisiert: {date}",
    loading: "Wird geladen…",
    intro:
      "Diese Bedingungen regeln den Kauf und die Nutzung des Online-Shops (der „Service“) von {siteName} (der „Shop“). Durch das Aufrufen oder den Kauf über den Service stimmen Sie den Bedingungen zu.",
    s1: "1. Unternehmensinformationen",
    s1_business: "Unternehmensname: {siteName}",
    s1_rep: "Vertretungsberechtigte Person: {ownerName}",
    s1_addr: "Adresse: {ownerAddress}",
    s1_contact:
      "Kontakt: {ownerEmail} / {ownerPhone} (Zeiten: Werktags 10:00–17:00 JST, Richtwert)",
    s1_related: "Zugehörige Richtlinien:",
    s1_refund: "Rückgabe- & Erstattungsrichtlinie",
    s1_privacy: "Datenschutzrichtlinie",
    s1_tokushoho:
      "Rechtliche Hinweise (jap. Gesetz über besondere Handelsgeschäfte)",
    s2: "2. Bestellung & Vertragsschluss",
    s2_1: "Der Kaufvertrag kommt mit Anzeige der Bestellabschlussseite oder Versand der Bestellbestätigung zustande.",
    s2_2: "Auch nach Vertragsschluss kann die Bestellung bei Doppelbestellung, Betrugsverdacht, längerem Lieferengpass oder Unmöglichkeit des Versands storniert werden.",
    s3: "3. Preise, Währung & Zahlung",
    s3_1: "Es gelten die auf der Website angezeigten Preise (grundsätzlich inkl. Steuern).",
    s3_2: "Zahlungen werden über Stripe abgewickelt.",
    s3_3: "Abrechnungswährung ist grundsätzlich JPY. Andere Währungen sind Richtwerte; der Endbetrag hängt vom Kartenanbieter ab.",
    s4: "4. Versand, Zoll & Einfuhrabgaben",
    s4_1: "Versandgebiete: Japan sowie vom Shop definierte Auslandsregionen.",
    s4_2: "Bei Auslandsversand trägt der Empfänger grundsätzlich Zölle, Einfuhrsteuern und Gebühren.",
    s4_3: "Bei Rücksendungen wegen Adressfehlern, Ablauf der Lagerfrist, Annahmeverweigerung oder Zollproblemen können Hin- und Rückversand sowie Gebühren berechnet werden.",
    s5: "5. Versandkosten & Freigrenzen",
    s5_p: "Versandkosten werden beim Checkout angezeigt. Bei Freigrenzen gilt die Anzeige im Warenkorb.",
    s6: "6. Rückgabe, Umtausch & Stornierung",
    s6_1: "Einzelheiten siehe Rückgabe- & Erstattungsrichtlinie.",
    s6_2: "Ein Widerrufsrecht ist im japanischen Fernabsatz in der Regel nicht vorgesehen.",
    s6_3: "Nach dem Versand sind Änderungen oder Stornierungen ggf. nicht möglich.",
    s7: "7. Produktinformationen & Lagerbestand",
    s7_1: "Abbildungen/Beschreibungen können leicht vom tatsächlichen Produkt abweichen (z. B. Farbe).",
    s7_2: "Der Bestand ändert sich laufend und ist beim Hinzufügen zum Warenkorb nicht reserviert. Bei Engpässen erfolgt Erstattung oder Alternativvorschlag.",
    s8: "8. Verbotene Handlungen",
    s8_p: "Gesetzesverstöße, Großeinkäufe zum Weiterverkauf, unbefugter Zugriff und Verstöße gegen Export/Import-Kontrollen sind untersagt.",
    s9: "9. Geistiges Eigentum",
    s9_p: "Rechte an Inhalten des Services liegen beim Shop oder Berechtigten. Unbefugte Vervielfältigung ist untersagt.",
    s10: "10. Haftungsausschluss",
    s10_1:
      "Keine Haftung bei höherer Gewalt oder außerhalb unserer Kontrolle (Katastrophen, Zoll/Transportverzögerungen, Netzstörungen, Plattform-/Zahlungsausfälle).",
    s10_2:
      "Außer bei Vorsatz oder grober Fahrlässigkeit ist die Haftung auf den vom Kunden gezahlten Preis begrenzt.",
    s11: "11. Personenbezogene Daten",
    s11_p:
      "Datenverarbeitung gemäß Datenschutzrichtlinie. Kartendaten werden sicher von Stripe verarbeitet; wir speichern sie nicht.",
    s12: "12. Nutzung durch Minderjährige",
    s12_p:
      "Minderjährige benötigen die Zustimmung eines Erziehungsberechtigten. Unbefugte Bestellungen können storniert werden.",
    s13: "13. Änderungen der Bedingungen",
    s13_p:
      "Anpassungen sind möglich und gelten ab Veröffentlichung im Service.",
    s14: "14. Anwendbares Recht & Gerichtsstand",
    s14_p:
      "Es gilt japanisches Recht. Gerichtsstand: Bezirksgericht Osaka (erste Instanz, ausschließliche Zuständigkeit).",
    s15: "15. Sprache",
    s15_p: "Bei Übersetzungen ist die japanische Version maßgeblich.",
    link_refund: "Rückgabe- & Erstattungsrichtlinie",
    link_privacy: "Datenschutzrichtlinie",
    link_tokushoho: "Rechtliche Hinweise",
    ogTitle: "Kaufbedingungen | {siteName}",
    ogDesc: "Bedingungen für Online-Einkäufe bei {siteName}.",
  },

  pt: {
    h1: "Termos de Compra",
    lastUpdated: "Última atualização: {date}",
    loading: "Carregando…",
    intro:
      "Estes Termos definem as condições de compra e uso da loja online (o “Serviço”) fornecida por {siteName} (a “Loja”). Ao navegar ou comprar no Serviço, você concorda com os Termos.",
    s1: "1. Informações da empresa",
    s1_business: "Nome da empresa: {siteName}",
    s1_rep: "Responsável: {ownerName}",
    s1_addr: "Endereço: {ownerAddress}",
    s1_contact:
      "Contato: {ownerEmail} / {ownerPhone} (horário: dias úteis 10:00–17:00 JST, referência)",
    s1_related: "Políticas relacionadas:",
    s1_refund: "Política de devolução e reembolso",
    s1_privacy: "Política de privacidade",
    s1_tokushoho:
      "Aviso legal (Lei Japonesa de Transações Comerciais Específicas)",
    s2: "2. Pedidos e formação do contrato",
    s2_1: "O contrato de compra é formado ao exibir a tela de pedido concluído ou ao enviar o e-mail de confirmação.",
    s2_2: "Mesmo após a formação, podemos cancelar o pedido em casos de duplicidade, suspeita de fraude, falta prolongada de estoque ou impossibilidade de envio.",
    s3: "3. Preço, moeda e pagamento",
    s3_1: "Os preços seguem o exibido no site (em geral, com impostos).",
    s3_2: "Pagamentos são processados pela Stripe.",
    s3_3: "A moeda de liquidação é JPY em princípio. Outras moedas exibidas são referenciais; o valor final depende da operadora do cartão.",
    s4: "4. Envio, alfândega e impostos de importação",
    s4_1: "Áreas de envio: Japão e regiões no exterior designadas pela loja.",
    s4_2: "Em envios internacionais, tarifas alfandegárias, impostos e taxas são, em princípio, do destinatário.",
    s4_3: "Em devoluções por erro de endereço, prazo de guarda expirado, recusa de recebimento ou problemas alfandegários, podem ser cobrados fretes de ida e volta e taxas.",
    s5: "5. Frete e limite para frete grátis",
    s5_p: "O valor do frete é exibido no checkout. Havendo limite para frete grátis, prevalece o carrinho.",
    s6: "6. Devoluções, trocas e cancelamentos",
    s6_1: "Consulte a Política de devolução e reembolso para detalhes.",
    s6_2: "Em vendas à distância no Japão, o direito de arrependimento geralmente não se aplica.",
    s6_3: "Após o envio, alterações ou cancelamentos podem não ser aceitos.",
    s7: "7. Informações do produto e estoque",
    s7_1: "As imagens e descrições podem diferir levemente do produto real (ex.: cor).",
    s7_2: "O estoque varia em tempo real e não é garantido ao adicionar ao carrinho. Em caso de falta, reembolsaremos ou proporemos alternativa.",
    s8: "8. Atos proibidos",
    s8_p: "Proibidas violações de leis, compras em grande volume para revenda, acesso não autorizado e atos que infrinjam controles de exportação/importação.",
    s9: "9. Propriedade intelectual",
    s9_p: "Os direitos do conteúdo pertencem à Loja ou aos detentores legítimos. É proibida a reprodução sem autorização.",
    s10: "10. Isenção de responsabilidade",
    s10_1:
      "Não nos responsabilizamos por danos causados por força maior ou motivos fora de nosso controle (desastres, atrasos alfandegários/transporte, falhas de rede, plataforma/pagamento).",
    s10_2:
      "Exceto em caso de dolo ou culpa grave, a responsabilidade limita-se ao valor pago pelo produto.",
    s11: "11. Dados pessoais",
    s11_p:
      "Os dados são tratados conforme a Política de privacidade. Os dados do cartão são processados pela Stripe; não os retemos.",
    s12: "12. Uso por menores",
    s12_p:
      "Menores devem obter consentimento do responsável. Pedidos não autorizados podem ser cancelados.",
    s13: "13. Alterações dos Termos",
    s13_p:
      "Podemos revisá-los quando necessário. Entram em vigor ao serem publicados no Serviço.",
    s14: "14. Lei aplicável e foro",
    s14_p:
      "Regem-se pela lei japonesa. Foro exclusivo: Tribunal Distrital de Osaka, em primeira instância.",
    s15: "15. Idioma",
    s15_p: "Em caso de tradução, prevalece a versão em japonês.",
    link_refund: "Política de devolução e reembolso",
    link_privacy: "Política de privacidade",
    link_tokushoho: "Aviso legal",
    ogTitle: "Termos de Compra | {siteName}",
    ogDesc: "Termos aplicáveis às compras online em {siteName}.",
  },

  it: {
    h1: "Condizioni di acquisto",
    lastUpdated: "Ultimo aggiornamento: {date}",
    loading: "Caricamento…",
    intro:
      "Le presenti Condizioni disciplinano l’acquisto e l’uso del negozio online (il “Servizio”) fornito da {siteName} (il “Negozio”). Navigando o acquistando tramite il Servizio, accetti le Condizioni.",
    s1: "1. Informazioni sull’azienda",
    s1_business: "Ragione sociale: {siteName}",
    s1_rep: "Rappresentante: {ownerName}",
    s1_addr: "Indirizzo: {ownerAddress}",
    s1_contact:
      "Contatti: {ownerEmail} / {ownerPhone} (orari: lun–ven 10:00–17:00 JST, indicativi)",
    s1_related: "Policy correlate:",
    s1_refund: "Politica di reso e rimborso",
    s1_privacy: "Informativa sulla privacy",
    s1_tokushoho:
      "Note legali (Legge giapponese sulle transazioni commerciali specifiche)",
    s2: "2. Ordini e formazione del contratto",
    s2_1: "Il contratto di vendita si perfeziona alla visualizzazione della pagina di ordine completato o all’invio dell’e-mail di conferma.",
    s2_2: "Anche dopo la formazione, l’ordine può essere annullato in caso di duplicati, sospetta frode, prolungata indisponibilità o impossibilità di spedizione.",
    s3: "3. Prezzi, valuta e pagamento",
    s3_1: "I prezzi seguono quanto indicato sul sito (in linea di principio, IVA inclusa).",
    s3_2: "I pagamenti sono elaborati da Stripe.",
    s3_3: "La valuta di regolamento è, in linea di principio, JPY. Altre valute visualizzate sono indicative; l’importo finale dipende dall’emittente della carta.",
    s4: "4. Spedizione, dogana e dazi",
    s4_1: "Aree di spedizione: Giappone e regioni estere designate dal negozio.",
    s4_2: "Per spedizioni internazionali, dazi, tasse d’importazione e commissioni sono, in linea di principio, a carico del destinatario.",
    s4_3: "In caso di reso per indirizzo errato, scadenza giacenza, rifiuto del ritiro o problemi doganali, possono essere addebitate spese di spedizione di andata e ritorno.",
    s5: "5. Spese di spedizione e soglie di gratuità",
    s5_p: "Le spese sono mostrate al checkout. Se è presente una soglia di spedizione gratuita, prevale quanto mostrato nel carrello.",
    s6: "6. Resi, cambi e cancellazioni",
    s6_1: "Vedere la Politica di reso e rimborso per i dettagli.",
    s6_2: "Nelle vendite a distanza in Giappone, il diritto di recesso generalmente non si applica.",
    s6_3: "Dopo la spedizione, modifiche o cancellazioni potrebbero non essere accettate.",
    s7: "7. Informazioni sul prodotto e stock",
    s7_1: "Immagini e descrizioni potrebbero differire leggermente dal prodotto reale (es. colore).",
    s7_2: "Lo stock varia in tempo reale e non è garantito al momento dell’aggiunta al carrello. In caso di indisponibilità, rimborso o alternativa.",
    s8: "8. Atti vietati",
    s8_p: "Vietate violazioni di legge, acquisti in grandi quantità per rivendita, accessi non autorizzati e violazioni dei controlli di import/export.",
    s9: "9. Proprietà intellettuale",
    s9_p: "I contenuti del Servizio appartengono al Negozio o ai titolari dei diritti. Vietata la riproduzione non autorizzata.",
    s10: "10. Esclusione di responsabilità",
    s10_1:
      "Nessuna responsabilità per danni causati da forza maggiore o cause al di fuori del nostro controllo (disastri, ritardi doganali/trasporto, interruzioni di rete, guasti della piattaforma/pagamento).",
    s10_2:
      "Salvo dolo o colpa grave, la responsabilità è limitata all’importo pagato per il prodotto.",
    s11: "11. Dati personali",
    s11_p:
      "I dati personali sono trattati secondo l’Informativa sulla privacy. I dati della carta sono elaborati in sicurezza da Stripe; non li conserviamo.",
    s12: "12. Utilizzo da parte di minori",
    s12_p:
      "I minori devono ottenere il consenso del tutore. In caso di uso non autorizzato, l’ordine può essere annullato.",
    s13: "13. Modifiche alle Condizioni",
    s13_p:
      "Possiamo modificarle se necessario. Entrano in vigore alla pubblicazione sul Servizio.",
    s14: "14. Legge applicabile e foro competente",
    s14_p:
      "Si applica la legge giapponese. Foro esclusivo: Tribunale distrettuale di Osaka, in primo grado.",
    s15: "15. Lingua",
    s15_p: "In caso di traduzione, fa fede la versione giapponese.",
    link_refund: "Politica di reso e rimborso",
    link_privacy: "Informativa sulla privacy",
    link_tokushoho: "Note legali",
    ogTitle: "Condizioni di acquisto | {siteName}",
    ogDesc: "Condizioni che disciplinano gli acquisti online su {siteName}.",
  },

  ru: {
    h1: "Условия покупки",
    lastUpdated: "Последнее обновление: {date}",
    loading: "Загрузка…",
    intro:
      "Настоящие Условия регулируют покупку и использование интернет-магазина («Сервис») компании {siteName} («Магазин»). Просматривая или совершая покупку, вы подтверждаете согласие с Условиями.",
    s1: "1. Информация о компании",
    s1_business: "Наименование: {siteName}",
    s1_rep: "Представитель: {ownerName}",
    s1_addr: "Адрес: {ownerAddress}",
    s1_contact:
      "Контакты: {ownerEmail} / {ownerPhone} (в будни 10:00–17:00 JST, ориентир)",
    s1_related: "Связанные политики:",
    s1_refund: "Политика возвратов и возмещений",
    s1_privacy: "Политика конфиденциальности",
    s1_tokushoho:
      "Юридическая информация (Закон Японии о специальных коммерческих сделках)",
    s2: "2. Заказ и заключение договора",
    s2_1: "Договор купли-продажи считается заключённым при отображении страницы завершения заказа или отправке письма-подтверждения.",
    s2_2: "Даже после заключения заказа мы можем его отменить при дублировании, подозрении на мошенничество, длительном отсутствии товара или невозможности доставки.",
    s3: "3. Цена, валюта и оплата",
    s3_1: "Цены соответствуют указанным на сайте (как правило, с налогами).",
    s3_2: "Платежи обрабатываются через Stripe.",
    s3_3: "Валюта расчётов — JPY. Прочие валюты носят справочный характер; итоговая сумма зависит от курса эмитента карты.",
    s4: "4. Доставка, таможня и импортные налоги",
    s4_1: "Регионы доставки: Япония и зарубежные регионы, указанные магазином.",
    s4_2: "При международной доставке пошлины, налоги и сборы обычно оплачивает получатель.",
    s4_3: "При возврате из-за ошибки адреса, истечения срока хранения, отказа от получения или проблем на таможне, могут взиматься расходы на пересылку в обе стороны и сборы.",
    s5: "5. Доставка и порог бесплатной доставки",
    s5_p: "Стоимость доставки указывается при оформлении. Если установлен порог бесплатной доставки, приоритет имеет корзина.",
    s6: "6. Возвраты, обмены и отмены",
    s6_1: "Подробности см. в Политике возвратов и возмещений.",
    s6_2: "Право на «охлаждение» обычно не применяется к дистанционной продаже в Японии.",
    s6_3: "После отправки изменение или отмена заказа могут быть невозможны.",
    s7: "7. Информация о товарах и наличии",
    s7_1: "Изображения и описания могут немного отличаться от реального товара (например, по цвету).",
    s7_2: "Наличие меняется в реальном времени и не резервируется при добавлении в корзину. При отсутствии — возврат или альтернатива.",
    s8: "8. Запрещённые действия",
    s8_p: "Запрещены нарушения закона, оптовые закупки для перепродажи, несанкционированный доступ и нарушение экспортно-импортного контроля.",
    s9: "9. Интеллектуальная собственность",
    s9_p: "Права на контент принадлежат Магазину или законным правообладателям. Запрещено несанкционированное копирование.",
    s10: "10. Ограничение ответственности",
    s10_1:
      "Мы не несём ответственности за ущерб вследствие форс-мажора или причин вне нашего разумного контроля (катастрофы, задержки на таможне/транспорте, сбои сети, платформы/платежей).",
    s10_2:
      "Исключая умысел или грубую небрежность, ответственность ограничена суммой, уплаченной за товар.",
    s11: "11. Персональные данные",
    s11_p:
      "Обрабатываются в соответствии с Политикой конфиденциальности. Данные карты обрабатываются Stripe и у нас не хранятся.",
    s12: "12. Несовершеннолетние",
    s12_p:
      "Несовершеннолетние должны получить согласие законного представителя. При несанкционированном использовании заказ может быть отменён.",
    s13: "13. Изменения Условий",
    s13_p:
      "Мы можем вносить изменения по мере необходимости. Они вступают в силу после публикации в Сервисе.",
    s14: "14. Применимое право и подсудность",
    s14_p:
      "Применяется право Японии. Споры подсудны Окружному суду Осаки (эксклюзивная подсудность, первая инстанция).",
    s15: "15. Язык",
    s15_p: "При наличии переводов приоритет имеет японская версия.",
    link_refund: "Политика возвратов и возмещений",
    link_privacy: "Политика конфиденциальности",
    link_tokushoho: "Юридическая информация",
    ogTitle: "Условия покупки | {siteName}",
    ogDesc: "Условия онлайн-покупок в {siteName}.",
  },

  th: {
    h1: "ข้อกำหนดการสั่งซื้อ",
    lastUpdated: "อัปเดตล่าสุด: {date}",
    loading: "กำลังโหลด…",
    intro:
      "ข้อกำหนดฉบับนี้กำหนดเงื่อนไขการซื้อและการใช้บริการร้านค้าออนไลน์ (“บริการ”) ที่ให้โดย {siteName} (“ร้านค้า”) เมื่อเข้าชมหรือสั่งซื้อผ่านบริการ ถือว่าคุณยอมรับข้อกำหนดแล้ว",
    s1: "1. ข้อมูลผู้ประกอบการ",
    s1_business: "ชื่อผู้ประกอบการ: {siteName}",
    s1_rep: "ผู้รับผิดชอบ: {ownerName}",
    s1_addr: "ที่อยู่: {ownerAddress}",
    s1_contact:
      "ติดต่อ: {ownerEmail} / {ownerPhone} (เวลาทำการ: จันทร์–ศุกร์ 10:00–17:00 ตามเวลา JST โดยประมาณ)",
    s1_related: "นโยบายที่เกี่ยวข้อง:",
    s1_refund: "นโยบายการคืนสินค้า/คืนเงิน",
    s1_privacy: "นโยบายความเป็นส่วนตัว",
    s1_tokushoho: "ประกาศทางกฎหมาย (กฎหมายธุรกรรมเชิงพาณิชย์เฉพาะของญี่ปุ่น)",
    s2: "2. การสั่งซื้อและการทำสัญญา",
    s2_1: "สัญญาซื้อขายมีผลเมื่อแสดงหน้าการสั่งซื้อเสร็จสิ้นหรือเมื่อส่งอีเมลยืนยันคำสั่งซื้อ",
    s2_2: "แม้สัญญาจะเกิดขึ้นแล้ว อาจยกเลิกคำสั่งซื้อได้หากพบการสั่งซ้ำ สงสัยฉ้อโกง สินค้าขาดสต็อกเป็นเวลานาน หรือไม่สามารถจัดส่งได้",
    s3: "3. ราคา สกุลเงิน และการชำระเงิน",
    s3_1: "ราคาสินค้าตามที่แสดงบนไซต์ (โดยหลักรวมภาษีแล้ว)",
    s3_2: "การชำระเงินดำเนินการผ่าน Stripe",
    s3_3: "สกุลเงินคิดเงินหลักคือ JPY การแสดงสกุลอื่นเป็นข้อมูลอ้างอิงเท่านั้น ยอดเรียกเก็บจริงขึ้นกับอัตราแลกเปลี่ยนของผู้ออกบัตร",
    s4: "4. การจัดส่ง ศุลกากร และภาษีนำเข้า",
    s4_1: "พื้นที่จัดส่ง: ญี่ปุ่นและพื้นที่ต่างประเทศที่ร้านกำหนด",
    s4_2: "การจัดส่งระหว่างประเทศ โดยหลักผู้รับต้องรับผิดชอบภาษีอากรและค่าดำเนินการศุลกากร",
    s4_3: "หากตีกลับเพราะที่อยู่ผิด หมดอายุกักเก็บ ปฏิเสธรับ หรือปัญหาศุลกากร อาจคิดค่าจัดส่งไป–กลับและค่าธรรมเนียม",
    s5: "5. ค่าจัดส่งและเงื่อนไขส่งฟรี",
    s5_p: "ค่าจัดส่งจะแสดงในขั้นตอนชำระเงิน หากตั้งเงื่อนไขส่งฟรี ให้ยึดตามที่แสดงในตะกร้า",
    s6: "6. การคืนสินค้า เปลี่ยนสินค้า และยกเลิก",
    s6_1: "ดูรายละเอียดที่นโยบายการคืนสินค้า/คืนเงิน",
    s6_2: "โดยทั่วไป กฎหมายคุ้มครองผู้บริโภคเรื่องระยะเวลาคิดทบทวนไม่ใช้กับการขายทางไกลในญี่ปุ่น",
    s6_3: "หลังส่งสินค้าแล้ว อาจไม่สามารถเปลี่ยนหรือยกเลิกคำสั่งซื้อได้",
    s7: "7. ข้อมูลสินค้าและสต็อก",
    s7_1: "รูปและคำอธิบายอาจต่างจากของจริงเล็กน้อย (เช่น สี)",
    s7_2: "สต็อกเปลี่ยนแปลงตลอดเวลา และไม่ถือว่าจองเมื่อเพิ่มลงตะกร้า หากขาดสต็อกจะคืนเงินหรือเสนอทางเลือก",
    s8: "8. การกระทำที่ต้องห้าม",
    s8_p: "ห้ามการกระทำที่ผิดกฎหมาย การซื้อจำนวนมากเพื่อขายต่อ การเข้าถึงโดยไม่ได้รับอนุญาต และการฝ่าฝืนกฎควบคุมการส่งออก/นำเข้า",
    s9: "9. ทรัพย์สินทางปัญญา",
    s9_p: "สิทธิ์ในเนื้อหาบนบริการเป็นของร้านค้าหรือผู้ถือสิทธิ์ที่ชอบด้วยกฎหมาย ห้ามทำซ้ำโดยไม่ได้รับอนุญาต",
    s10: "10. ข้อจำกัดความรับผิด",
    s10_1:
      "ไม่รับผิดชอบความเสียหายอันเกิดจากเหตุสุดวิสัยหรือสาเหตุที่อยู่นอกการควบคุมที่สมเหตุสมผล (ภัยพิบัติ ความล่าช้าศุลกากร/ขนส่ง ความขัดข้องของเครือข่าย แพลตฟอร์ม/การชำระเงิน)",
    s10_2:
      "เว้นแต่กรณีเจตนาหรือประมาทอย่างร้ายแรง ความรับผิดจำกัดเท่าจำนวนเงินที่ชำระค่าสินค้า",
    s11: "11. ข้อมูลส่วนบุคคล",
    s11_p:
      "ข้อมูลส่วนบุคคลจัดการตามนโยบายความเป็นส่วนตัว ข้อมูลบัตรถูกประมวลผลโดย Stripe อย่างปลอดภัย เราไม่เก็บข้อมูลบัตร",
    s12: "12. ผู้เยาว์",
    s12_p:
      "ผู้เยาว์ต้องได้รับความยินยอมจากผู้ปกครอง หากพบการใช้งานโดยไม่ได้รับอนุญาต อาจยกเลิกคำสั่งซื้อ",
    s13: "13. การเปลี่ยนแปลงข้อกำหนด",
    s13_p: "อาจปรับปรุงข้อกำหนดได้ตามความจำเป็น และมีผลเมื่อประกาศในบริการ",
    s14: "14. กฎหมายที่ใช้บังคับและเขตอำนาจศาล",
    s14_p:
      "อยู่ภายใต้กฎหมายญี่ปุ่น ข้อพิพาทอยู่ในอำนาจศาลของศาลแขวงโอซากะ (ชั้นต้น โดยเฉพาะ)",
    s15: "15. ภาษา",
    s15_p: "หากมีฉบับแปล ให้ยึดฉบับภาษาญี่ปุ่นเป็นทางการ",
    link_refund: "นโยบายการคืนสินค้า/คืนเงิน",
    link_privacy: "นโยบายความเป็นส่วนตัว",
    link_tokushoho: "ประกาศทางกฎหมาย",
    ogTitle: "ข้อกำหนดการสั่งซื้อ | {siteName}",
    ogDesc: "ข้อกำหนดสำหรับการซื้อออนไลน์บน {siteName}.",
  },

  vi: {
    h1: "Điều khoản mua hàng",
    lastUpdated: "Cập nhật lần cuối: {date}",
    loading: "Đang tải…",
    intro:
      "Điều khoản này quy định điều kiện mua và sử dụng cửa hàng trực tuyến (“Dịch vụ”) do {siteName} (“Cửa hàng”) cung cấp. Khi truy cập hoặc mua hàng, bạn được xem là đã đồng ý với Điều khoản.",
    s1: "1. Thông tin doanh nghiệp",
    s1_business: "Tên doanh nghiệp: {siteName}",
    s1_rep: "Người đại diện: {ownerName}",
    s1_addr: "Địa chỉ: {ownerAddress}",
    s1_contact:
      "Liên hệ: {ownerEmail} / {ownerPhone} (giờ: Thứ Hai–Sáu 10:00–17:00 JST, tham khảo)",
    s1_related: "Chính sách liên quan:",
    s1_refund: "Chính sách đổi trả & hoàn tiền",
    s1_privacy: "Chính sách quyền riêng tư",
    s1_tokushoho:
      "Thông báo pháp lý (Luật Giao dịch thương mại đặc thù của Nhật Bản)",
    s2: "2. Đặt hàng & hình thành hợp đồng",
    s2_1: "Hợp đồng mua bán được hình thành khi hiển thị trang hoàn tất đơn hàng hoặc khi gửi email xác nhận.",
    s2_2: "Ngay cả sau khi hình thành, có thể hủy đơn trong trường hợp trùng lặp, nghi ngờ gian lận, hết hàng dài ngày hoặc không thể giao.",
    s3: "3. Giá, tiền tệ & thanh toán",
    s3_1: "Giá sản phẩm theo hiển thị trên trang (thường đã gồm thuế).",
    s3_2: "Thanh toán được xử lý bởi Stripe.",
    s3_3: "Tiền tệ thanh toán là JPY. Các tiền tệ khác chỉ tham khảo; số tiền cuối cùng phụ thuộc tỷ giá của đơn vị phát hành thẻ.",
    s4: "4. Giao hàng, hải quan & thuế nhập khẩu",
    s4_1: "Khu vực giao: Nhật Bản và các khu vực nước ngoài do cửa hàng chỉ định.",
    s4_2: "Với giao quốc tế, người nhận chịu thuế hải quan, thuế nhập khẩu và phí môi giới.",
    s4_3: "Nếu bị trả lại vì sai địa chỉ, hết hạn lưu kho, từ chối nhận hoặc vấn đề hải quan, có thể tính phí vận chuyển hai chiều và phụ phí.",
    s5: "5. Phí vận chuyển & ngưỡng miễn phí",
    s5_p: "Phí vận chuyển hiển thị khi thanh toán. Nếu có ngưỡng miễn phí, ưu tiên theo giỏ hàng.",
    s6: "6. Đổi trả, đổi hàng & hủy",
    s6_1: "Xem chi tiết tại Chính sách đổi trả & hoàn tiền.",
    s6_2: "Tại Nhật Bản, bán hàng từ xa thường không áp dụng quyền hủy trong thời gian cân nhắc.",
    s6_3: "Sau khi gửi hàng, có thể không chấp nhận thay đổi hoặc hủy.",
    s7: "7. Thông tin sản phẩm & tồn kho",
    s7_1: "Hình ảnh & mô tả có thể khác đôi chút so với thực tế (ví dụ màu sắc).",
    s7_2: "Tồn kho thay đổi theo thời gian thực và không giữ chỗ khi thêm vào giỏ. Nếu hết, chúng tôi hoàn tiền hoặc đề xuất thay thế.",
    s8: "8. Hành vi bị cấm",
    s8_p: "Cấm vi phạm luật, mua số lượng lớn để bán lại, truy cập trái phép, vi phạm kiểm soát xuất/nhập khẩu.",
    s9: "9. Sở hữu trí tuệ",
    s9_p: "Quyền đối với nội dung thuộc Cửa hàng hoặc chủ sở hữu hợp pháp. Cấm sao chép khi chưa được phép.",
    s10: "10. Miễn trừ trách nhiệm",
    s10_1:
      "Không chịu trách nhiệm thiệt hại do sự kiện bất khả kháng hoặc ngoài tầm kiểm soát hợp lý (thiên tai, chậm trễ hải quan/vận chuyển, sự cố mạng, nền tảng/thanh toán).",
    s10_2:
      "Trừ trường hợp cố ý hoặc lỗi nghiêm trọng, trách nhiệm giới hạn ở số tiền bạn đã trả cho sản phẩm.",
    s11: "11. Dữ liệu cá nhân",
    s11_p:
      "Xử lý theo Chính sách quyền riêng tư. Dữ liệu thẻ do Stripe xử lý an toàn; chúng tôi không lưu trữ.",
    s12: "12. Người chưa thành niên",
    s12_p:
      "Phải có sự đồng ý của người giám hộ. Nếu phát hiện sử dụng trái phép, đơn hàng có thể bị hủy.",
    s13: "13. Thay đổi Điều khoản",
    s13_p: "Có thể sửa đổi khi cần. Có hiệu lực khi công bố trên Dịch vụ.",
    s14: "14. Luật áp dụng & tài phán",
    s14_p:
      "Tuân theo luật Nhật Bản. Tranh chấp thuộc thẩm quyền riêng của Tòa án Quận Osaka (sơ thẩm).",
    s15: "15. Ngôn ngữ",
    s15_p: "Nếu có bản dịch, phiên bản tiếng Nhật là bản chính.",
    link_refund: "Chính sách đổi trả & hoàn tiền",
    link_privacy: "Chính sách quyền riêng tư",
    link_tokushoho: "Thông báo pháp lý",
    ogTitle: "Điều khoản mua hàng | {siteName}",
    ogDesc: "Điều khoản áp dụng cho mua sắm trực tuyến tại {siteName}.",
  },

  id: {
    h1: "Syarat Pembelian",
    lastUpdated: "Pembaruan terakhir: {date}",
    loading: "Memuat…",
    intro:
      "Syarat ini mengatur ketentuan pembelian dan penggunaan toko online (“Layanan”) yang disediakan oleh {siteName} (“Toko”). Dengan menelusuri atau membeli melalui Layanan, Anda dianggap menyetujui Syarat ini.",
    s1: "1. Informasi bisnis",
    s1_business: "Nama bisnis: {siteName}",
    s1_rep: "Penanggung jawab: {ownerName}",
    s1_addr: "Alamat: {ownerAddress}",
    s1_contact:
      "Kontak: {ownerEmail} / {ownerPhone} (jam: Sen–Jum 10.00–17.00 JST, perkiraan)",
    s1_related: "Kebijakan terkait:",
    s1_refund: "Kebijakan pengembalian & refund",
    s1_privacy: "Kebijakan privasi",
    s1_tokushoho: "Pemberitahuan hukum (UU Transaksi Komersial Khusus Jepang)",
    s2: "2. Pesanan & pembentukan kontrak",
    s2_1: "Kontrak jual-beli terbentuk saat layar pesanan selesai ditampilkan atau email konfirmasi dikirim.",
    s2_2: "Meski sudah terbentuk, pesanan dapat dibatalkan jika terjadi duplikasi, dugaan penipuan, stok kosong berkepanjangan, atau tidak dapat dikirim.",
    s3: "3. Harga, mata uang & pembayaran",
    s3_1: "Harga sesuai tampilan di situs (umumnya termasuk pajak).",
    s3_2: "Pembayaran diproses oleh Stripe.",
    s3_3: "Mata uang penyelesaian adalah JPY. Tampilan mata uang lain hanya referensi; tagihan akhir tergantung kurs penerbit kartu.",
    s4: "4. Pengiriman, bea cukai & pajak impor",
    s4_1: "Area pengiriman: Jepang dan wilayah luar negeri yang ditetapkan toko.",
    s4_2: "Untuk pengiriman internasional, bea masuk, pajak impor, dan biaya penanganan ditanggung penerima.",
    s4_3: "Jika paket dikembalikan karena alamat salah, masa simpan habis, penolakan terima, atau masalah bea cukai, biaya kirim pulang-pergi dan biaya lain dapat dikenakan.",
    s5: "5. Ongkos kirim & ambang gratis ongkir",
    s5_p: "Ongkos kirim ditampilkan saat checkout. Jika ada ambang gratis ongkir, tampilan keranjang berlaku.",
    s6: "6. Retur, tukar & pembatalan",
    s6_1: "Lihat Kebijakan pengembalian & refund untuk detail.",
    s6_2: "Dalam penjualan jarak jauh di Jepang, hak pembatalan umumnya tidak berlaku.",
    s6_3: "Setelah pengiriman, perubahan atau pembatalan mungkin tidak diterima.",
    s7: "7. Informasi produk & stok",
    s7_1: "Gambar dan deskripsi mungkin sedikit berbeda dari produk sebenarnya (misal warna).",
    s7_2: "Stok berubah waktu nyata dan tidak dijamin saat menambahkan ke keranjang. Jika kosong, kami refund atau tawarkan alternatif.",
    s8: "8. Tindakan terlarang",
    s8_p: "Dilarang melanggar hukum, membeli dalam jumlah besar untuk dijual kembali, akses tidak sah, serta pelanggaran kontrol ekspor/impor.",
    s9: "9. Kekayaan intelektual",
    s9_p: "Hak atas konten pada Layanan milik Toko atau pemegang hak yang sah. Dilarang menyalin tanpa izin.",
    s10: "10. Penafian tanggung jawab",
    s10_1:
      "Kami tidak bertanggung jawab atas kerugian karena force majeure atau di luar kendali wajar (bencana, keterlambatan bea cukai/pengiriman, gangguan jaringan, kegagalan platform/pembayaran).",
    s10_2:
      "Kecuali kesengajaan atau kelalaian berat, tanggung jawab dibatasi pada jumlah yang Anda bayarkan untuk produk.",
    s11: "11. Data pribadi",
    s11_p:
      "Ditangani sesuai Kebijakan privasi. Data kartu diproses aman oleh Stripe; kami tidak menyimpannya.",
    s12: "12. Penggunaan oleh anak di bawah umur",
    s12_p:
      "Harus ada persetujuan orang tua/wali. Pesanan dapat dibatalkan jika penggunaan tidak sah ditemukan.",
    s13: "13. Perubahan Syarat",
    s13_p:
      "Dapat direvisi bila perlu, dan berlaku saat dipublikasikan di Layanan.",
    s14: "14. Hukum yang berlaku & yurisdiksi",
    s14_p:
      "Mengacu pada hukum Jepang. Sengketa berada di yurisdiksi eksklusif Pengadilan Distrik Osaka (tingkat pertama).",
    s15: "15. Bahasa",
    s15_p:
      "Jika ada terjemahan, versi bahasa Jepang berlaku sebagai naskah resmi.",
    link_refund: "Kebijakan pengembalian & refund",
    link_privacy: "Kebijakan privasi",
    link_tokushoho: "Pemberitahuan hukum",
    ogTitle: "Syarat Pembelian | {siteName}",
    ogDesc: "Syarat untuk pembelian online di {siteName}.",
  },

  hi: {
    h1: "खरीद की शर्तें",
    lastUpdated: "अंतिम अपडेट: {date}",
    loading: "लोड हो रहा है…",
    intro:
      "ये शर्तें {siteName} (“स्टोर”) द्वारा प्रदान किए गए ऑनलाइन स्टोर (“सेवा”) के खरीद और उपयोग की शर्तें निर्धारित करती हैं। सेवा का उपयोग या खरीद करते ही आप इन शर्तों से सहमत माने जाते हैं।",
    s1: "1. व्यावसायिक जानकारी",
    s1_business: "व्यवसाय का नाम: {siteName}",
    s1_rep: "प्रतिनिधि: {ownerName}",
    s1_addr: "पता: {ownerAddress}",
    s1_contact:
      "संपर्क: {ownerEmail} / {ownerPhone} (समय: कार्यदिवस 10:00–17:00 JST, अनुमानित)",
    s1_related: "संबंधित नीतियाँ:",
    s1_refund: "रिटर्न व रिफंड नीति",
    s1_privacy: "गोपनीयता नीति",
    s1_tokushoho: "कानूनी सूचना (जापान का विशेष वाणिज्यिक लेन-देन अधिनियम)",
    s2: "2. ऑर्डर व अनुबंध का गठन",
    s2_1: "ऑर्डर-कम्प्लीट स्क्रीन दिखने या ऑर्डर-कन्फर्म ई-मेल भेजे जाने पर बिक्री अनुबंध बन जाता है।",
    s2_2: "डुप्लिकेट, धोखाधड़ी की आशंका, दीर्घकालिक स्टॉक-आउट या शिपिंग असमर्थता की स्थिति में, अनुबंध के बाद भी ऑर्डर रद्द किया जा सकता है।",
    s3: "3. मूल्य, मुद्रा व भुगतान",
    s3_1: "उत्पाद-मूल्य साइट पर प्रदर्शित (सामान्यतः कर-समेत) के अनुसार होगा।",
    s3_2: "भुगतान Stripe के माध्यम से संसाधित होता है।",
    s3_3: "सेटलमेंट मुद्रा प्रायः JPY है। अन्य मुद्रा केवल संदर्भ हेतु; अंतिम राशि कार्ड-जारीकर्ता की दर पर निर्भर कर सकती है।",
    s4: "4. शिपिंग, कस्टम्स व आयात-कर",
    s4_1: "शिपिंग क्षेत्र: जापान व दुकान द्वारा निर्दिष्ट अन्य विदेशी क्षेत्र।",
    s4_2: "अंतरराष्ट्रीय शिपिंग में कस्टम शुल्क, आयात कर व ब्रोकरेज शुल्क सामान्यतः प्राप्तकर्ता द्वारा वहन किए जाते हैं।",
    s4_3: "पते की त्रुटि, भंडारण-समय सीमा समाप्ति, रिसीव करने से इन्कार या कस्टम समस्या पर रीटर्न होने पर, दोनों ओर का शिपिंग व शुल्क लिए जा सकते हैं।",
    s5: "5. शिपिंग-शुल्क व फ्री शिपिंग सीमा",
    s5_p: "शिपिंग-शुल्क चेकआउट पर दिखेगा। यदि फ्री-शिपिंग सीमा है, तो कार्ट-दिखावट को प्राथमिकता मिलेगी।",
    s6: "6. रिटर्न, एक्सचेंज व कैंसिलेशन",
    s6_1: "विवरण हेतु रिटर्न व रिफंड नीति देखें।",
    s6_2: "जापान में दूरस्थ बिक्री पर सामान्यतः कूलिंग-ऑफ लागू नहीं होता।",
    s6_3: "डिस्पैच के बाद परिवर्तन या रद्दीकरण स्वीकार न भी किया जा सके।",
    s7: "7. उत्पाद-जानकारी व स्टॉक",
    s7_1: "चित्र/वर्णन वास्तविक उत्पाद से (जैसे रंग) थोड़ा भिन्न हो सकते हैं।",
    s7_2: "स्टॉक वास्तविक-समय में बदलता है और कार्ट में जोड़ने से आरक्षित नहीं होता। स्टॉक-आउट पर रिफंड या विकल्प प्रस्तावित होगा।",
    s8: "8. निषिद्ध कार्य",
    s8_p: "कानून-विरुद्ध कार्य, पुनर्विक्रय हेतु बड़े पैमाने की खरीद, अनधिकृत एक्सेस, निर्यात/आयात नियंत्रण का उल्लंघन—निषिद्ध हैं।",
    s9: "9. बौद्धिक संपदा",
    s9_p: "सेवा पर सामग्री के अधिकार स्टोर या विधिसम्मत स्वामियों के हैं। अनधिकृत प्रतिलिपि/प्रकाशन वर्जित है।",
    s10: "10. दायित्व-सीमा",
    s10_1:
      "फोर्स मेज्योर या हमारे उचित नियंत्रण से बाहर कारणों (आपदा, कस्टम/शिपिंग विलंब, नेटवर्क/प्लेटफ़ॉर्म/पेमेंट विफलता) से हुए नुकसान हेतु हम उत्तरदायी नहीं हैं।",
    s10_2:
      "जानबूझकर त्रुटि या घोर लापरवाही को छोड़कर, दायित्व की अधिकतम सीमा वह राशि होगी जो आपने उत्पाद हेतु भुगतान की है।",
    s11: "11. व्यक्तिगत डेटा",
    s11_p:
      "गोपनीयता नीति के अनुसार संसाधित। कार्ड-डेटा Stripe द्वारा सुरक्षित रूप से प्रोसेस; हम सुरक्षित नहीं रखते।",
    s12: "12. नाबालिगों द्वारा उपयोग",
    s12_p:
      "अभिभावक की सहमति आवश्यक। अनधिकृत उपयोग मिलने पर ऑर्डर रद्द हो सकता है।",
    s13: "13. शर्तों में परिवर्तन",
    s13_p: "आवश्यकता अनुसार संशोधन सम्भव; सेवा पर प्रकाशित होते ही प्रभावी।",
    s14: "14. लागू कानून व क्षेत्राधिकार",
    s14_p:
      "जापानी कानून लागू। विवाद—ओसाका जिला न्यायालय का प्रथम-अपील विशेष क्षेत्राधिकार।",
    s15: "15. भाषा",
    s15_p: "अनुवाद होने पर, जापानी संस्करण प्रामाणिक माना जाएगा।",
    link_refund: "रिटर्न व रिफंड नीति",
    link_privacy: "गोपनीयता नीति",
    link_tokushoho: "कानूनी सूचना",
    ogTitle: "खरीद की शर्तें | {siteName}",
    ogDesc: "{siteName} पर ऑनलाइन खरीद से सम्बद्ध शर्तें।",
  },

  ar: {
    h1: "شروط الشراء",
    lastUpdated: "آخر تحديث: {date}",
    loading: "جارٍ التحميل…",
    intro:
      "تحدد هذه الشروط أحكام الشراء واستخدام المتجر الإلكتروني («الخدمة») المقدم من {siteName} («المتجر»). باستخدامك الخدمة أو الشراء عبرها فأنت توافق على الشروط.",
    s1: "1. معلومات النشاط",
    s1_business: "اسم النشاط: {siteName}",
    s1_rep: "الممثل: {ownerName}",
    s1_addr: "العنوان: {ownerAddress}",
    s1_contact:
      "الاتصال: {ownerEmail} / {ownerPhone} (الأوقات: أيام الأسبوع 10:00–17:00 بتوقيت اليابان تقريبًا)",
    s1_related: "السياسات ذات الصلة:",
    s1_refund: "سياسة الإرجاع واسترداد المبلغ",
    s1_privacy: "سياسة الخصوصية",
    s1_tokushoho: "إشعار قانوني (قانون المعاملات التجارية المحددة في اليابان)",
    s2: "2. الطلبات وإبرام العقد",
    s2_1: "يتم إبرام عقد البيع عند ظهور صفحة اكتمال الطلب أو عند إرسال رسالة تأكيد الطلب.",
    s2_2: "حتى بعد الإبرام، قد نلغي الطلب في حالات التكرار، الاشتباه في الاحتيال، نفاد المخزون طويلًا، أو تعذر الشحن.",
    s3: "3. الأسعار والعملات والدفع",
    s3_1: "الأسعار وفقًا لما يظهر في الموقع (شاملةً للضريبة غالبًا).",
    s3_2: "تُعالج المدفوعات عبر Stripe.",
    s3_3: "عملة التسوية هي الين الياباني (JPY) كقاعدة عامة. أي عملات أخرى للعرض فقط؛ المبلغ النهائي يعتمد على سعر جهة إصدار البطاقة.",
    s4: "4. الشحن والجمارك والضرائب",
    s4_1: "مناطق الشحن: اليابان والمناطق الخارجية التي يحددها المتجر.",
    s4_2: "بالشحن الدولي، يتحمل المستلم الرسوم الجمركية وضرائب الاستيراد وعمولات التخليص غالبًا.",
    s4_3: "عند الإرجاع بسبب خطأ في العنوان أو انتهاء مدة الحفظ أو رفض الاستلام أو مشاكل الجمارك، قد تُفرض رسوم الشحن ذهابًا وإيابًا ورسوم إضافية.",
    s5: "5. رسوم الشحن وحدّ الشحن المجاني",
    s5_p: "تُعرض رسوم الشحن عند الدفع. إن وُجد حدّ للشحن المجاني، فتُعتمد تفاصيل عربة التسوق.",
    s6: "6. الإرجاع والاستبدال والإلغاء",
    s6_1: "التفاصيل في سياسة الإرجاع واسترداد المبلغ.",
    s6_2: "لا ينطبق عادة حق العدول على المبيعات عن بُعد في اليابان.",
    s6_3: "قد لا يُقبل التغيير أو الإلغاء بعد الشحن.",
    s7: "7. معلومات المنتج والمخزون",
    s7_1: "قد تختلف الصور والأوصاف قليلًا عن المنتج الفعلي (مثل اللون).",
    s7_2: "المخزون يتغير آنيًا ولا يُحجز بمجرد الإضافة إلى السلة. عند النفاد، سنُرجع المبلغ أو نقترح بديلًا.",
    s8: "8. الأفعال المحظورة",
    s8_p: "مخالفة القوانين، الشراء بكميات كبيرة بغرض إعادة البيع، الوصول غير المصرح به، ومخالفة ضوابط التصدير/الاستيراد محظورة.",
    s9: "9. الملكية الفكرية",
    s9_p: "حقوق محتوى الخدمة تخص المتجر أو أصحاب الحقوق الشرعيين. يُحظر النسخ دون تصريح.",
    s10: "10. إخلاء المسؤولية",
    s10_1:
      "لا نتحمل المسؤولية عن الأضرار الناتجة عن القوة القاهرة أو الأسباب الخارجة عن سيطرتنا المعقولة (كوارث، تأخر الجمارك/النقل، أعطال الشبكة أو المنصة/الدفع).",
    s10_2:
      "باستثناء العمد أو الإهمال الجسيم، تُحدّد مسؤوليتنا بالمبلغ الذي دفعته مقابل المنتج.",
    s11: "11. البيانات الشخصية",
    s11_p:
      "تُعالج وفق سياسة الخصوصية. تُعالج Stripe بيانات البطاقات بأمان ولا نحتفظ بها.",
    s12: "12. استخدام القاصرين",
    s12_p:
      "يجب حصول القاصر على موافقة الوصي. قد يُلغى الطلب عند اكتشاف استخدام غير مصرح.",
    s13: "13. تغييرات الشروط",
    s13_p: "يجوز تعديلها عند الحاجة وتسري عند نشرها في الخدمة.",
    s14: "14. القانون والاختصاص القضائي",
    s14_p:
      "تخضع للقانون الياباني. تختص محكمة مقاطعة أوساكا حصريًا كدرجة أولى في أي نزاع.",
    s15: "15. اللغة",
    s15_p: "عند وجود ترجمات، تكون النسخة اليابانية هي المعتمدة.",
    link_refund: "سياسة الإرجاع واسترداد المبلغ",
    link_privacy: "سياسة الخصوصية",
    link_tokushoho: "إشعار قانوني",
    ogTitle: "شروط الشراء | {siteName}",
    ogDesc: "الشروط الحاكمة للمشتريات عبر الإنترنت لدى {siteName}.",
  },
} as const;

/* ===== 言語解決（大小文字・リージョン・別名を正規化） ===== */
const CANON_BY_LC = new Map<string, LangKey>();
for (const l of LANGS) {
  CANON_BY_LC.set(l.key.toLowerCase(), l.key as LangKey);
}
// 代表的な別名（必要に応じて追加OK）
const ALIAS_BY_LC = new Map<string, LangKey>([
  ["zh-hant", "zh-TW" as LangKey],
  ["zh-hk", "zh-TW" as LangKey],
  ["zh-mo", "zh-TW" as LangKey],
  ["zh-sg", "zh" as LangKey],
  ["zh-cn", "zh" as LangKey],
  ["en-us", "en" as LangKey],
  ["en-gb", "en" as LangKey],
  ["pt-br", "pt" as LangKey],
  ["ko-kr", "ko" as LangKey],
  ["ja-jp", "ja" as LangKey],
  ["ar-sa", "ar" as LangKey],
  ["ar-eg", "ar" as LangKey],
]);

function resolveLang(raw?: string | null): LangKey {
  const lcAll = (raw ?? "").toLowerCase().trim();
  if (!lcAll) return "ja" as LangKey;

  // Accept-Language 形式 "zh-TW,zh;q=0.9" の先頭を抽出
  const primary = lcAll.split(",")[0]?.split(";")[0]?.trim() ?? "";

  // 完全一致（大小無視）
  if (CANON_BY_LC.has(primary)) return CANON_BY_LC.get(primary)!;
  if (ALIAS_BY_LC.has(primary)) return ALIAS_BY_LC.get(primary)!;

  // サブタグの先頭だけで再解決（例: en-US -> en）
  const base = primary.split("-")[0] ?? "";
  if (CANON_BY_LC.has(base)) return CANON_BY_LC.get(base)!;
  if (ALIAS_BY_LC.has(base)) return ALIAS_BY_LC.get(base)!;

  return "ja" as LangKey;
}

function t(lang: LangKey, key: string, params?: Record<string, string>) {
  const base = I18N[lang]?.[key] ?? I18N.ja[key] ?? key;
  if (!params) return base;
  return base.replace(/\{(\w+)\}/g, (_: string, k: string) => params[k] ?? "");
}

export default function TermsPage() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // あなたのフック仕様に合わせて取得（なければ "ja"）
  let ui = "ja" as LangKey;
  try {
    const u = useUILang?.();
    ui = resolveLang(
      (u && (u.uiLang || (Array.isArray(u) ? u[0] : ""))) as string
    );
  } catch {
    ui = "ja";
  }
  const lang = ui;

  // Firestoreから siteSettings を1回取得
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "siteSettings", SITE_KEY);
        const snap = await getDoc(ref);
        setS((snap.data() as SiteSettings) ?? {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 表示用の安全な値（デフォルト名称は簡易に en/その他 で分岐）
  const siteName =
    s?.siteName?.trim() ||
    (lang === "en" ? "Online Shop" : "オンラインショップ");
  const ownerName =
    s?.ownerName?.trim() ||
    (lang === "en" ? "(Representative)" : "（代表者名）");
  const ownerAddress =
    s?.ownerAddress?.trim() || (lang === "en" ? "(Address)" : "（所在地）");
  const ownerEmail =
    s?.ownerEmail?.trim() || (lang === "en" ? "(Email)" : "（メールアドレス）");
  const ownerPhone =
    s?.ownerPhone?.trim() || (lang === "en" ? "(Phone)" : "（電話番号）");

  // 日付表示：ja は和文、その他は ISO 風
  const updatedYmd = useMemo(() => {
    const d =
      s?.updatedAt?.toDate?.() ?? s?.createdAt?.toDate?.() ?? new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${day}`;
    return lang === "ja" ? `${y}年${m}月${day}日` : iso;
  }, [s?.updatedAt, s?.createdAt, lang]);

  // canonical / OGP は環境変数から（末尾スラッシュ整理）
  const BASE = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const canonical = BASE ? `${BASE}/terms` : "/terms";
  const ogTitle = t(lang, "ogTitle", { siteName });
  const ogDesc = t(lang, "ogDesc", { siteName });

  const isRTL = lang === "ar";

  return (
    <>
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:type" content="article" />
      </Head>

      <main className="min-h-screen bg-white" dir={isRTL ? "rtl" : "ltr"}>
        <section className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold mb-6">{t(lang, "h1")}</h1>
          <p className="text-sm text-gray-500 mb-8">
            {t(lang, "lastUpdated", { date: updatedYmd })}
          </p>

          {loading && (
            <p className="text-gray-500 mb-8">{t(lang, "loading")}</p>
          )}

          <p className="mb-6">{t(lang, "intro", { siteName })}</p>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s1")}</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t(lang, "s1_business", { siteName })}</li>
            <li>{t(lang, "s1_rep", { ownerName })}</li>
            <li>{t(lang, "s1_addr", { ownerAddress })}</li>
            <li>{t(lang, "s1_contact", { ownerEmail, ownerPhone })}</li>
            <li>
              {t(lang, "s1_related")}
              <ul className="list-disc pl-6 mt-1">
                <li>
                  <a className="underline" href="/refund">
                    {t(lang, "s1_refund")}
                  </a>
                </li>
                <li>
                  <a className="underline" href="/privacy">
                    {t(lang, "s1_privacy")}
                  </a>
                </li>
                <li>
                  <a className="underline" href="/tokushoho">
                    {t(lang, "s1_tokushoho")}
                  </a>
                </li>
              </ul>
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s2")}</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>{t(lang, "s2_1")}</li>
            <li>{t(lang, "s2_2")}</li>
          </ol>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s3")}</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>{t(lang, "s3_1")}</li>
            <li>{t(lang, "s3_2")}</li>
            <li>{t(lang, "s3_3")}</li>
          </ol>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s4")}</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>{t(lang, "s4_1")}</li>
            <li>{t(lang, "s4_2")}</li>
            <li>{t(lang, "s4_3")}</li>
          </ol>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s5")}</h2>
          <p>{t(lang, "s5_p")}</p>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s6")}</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>
              {lang === "ja" ? (
                <>
                  条件は{" "}
                  <a className="underline" href="/refund">
                    {t(lang, "link_refund")}
                  </a>{" "}
                  に定めます。
                </>
              ) : (
                <>
                  See{" "}
                  <a className="underline" href="/refund">
                    {t(lang, "link_refund")}
                  </a>{" "}
                  for details.
                </>
              )}
            </li>
            <li>{t(lang, "s6_2")}</li>
            <li>{t(lang, "s6_3")}</li>
          </ol>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s7")}</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>{t(lang, "s7_1")}</li>
            <li>{t(lang, "s7_2")}</li>
          </ol>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s8")}</h2>
          <p>{t(lang, "s8_p")}</p>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s9")}</h2>
          <p>{t(lang, "s9_p")}</p>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s10")}</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>{t(lang, "s10_1")}</li>
            <li>{t(lang, "s10_2")}</li>
          </ol>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s11")}</h2>
          <p>
            {lang === "ja" ? (
              <>
                個人情報は{" "}
                <a className="underline" href="/privacy">
                  {t(lang, "link_privacy")}
                </a>{" "}
                に従い取扱います。カード情報は Stripe
                社により安全に処理され、当店は保持しません。
              </>
            ) : (
              <>
                Personal data is handled in accordance with the{" "}
                <a className="underline" href="/privacy">
                  {t(lang, "link_privacy")}
                </a>
                . Card data is securely processed by Stripe and not retained by
                us.
              </>
            )}
          </p>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s12")}</h2>
          <p>{t(lang, "s12_p")}</p>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s13")}</h2>
          <p>{t(lang, "s13_p")}</p>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s14")}</h2>
          <p>{t(lang, "s14_p")}</p>

          <h2 className="text-xl font-semibold mt-10 mb-3">{t(lang, "s15")}</h2>
          <p>{t(lang, "s15_p")}</p>
        </section>
      </main>
    </>
  );
}
