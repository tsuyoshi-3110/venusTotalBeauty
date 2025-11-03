// src/app/privacy/page.tsx
"use client";

import Head from "next/head";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang } from "@/lib/atoms/uiLangAtom";

type OwnerSettings = {
  siteName?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerAddress?: string;
  ownerPhone?: string;
};

/* ================= i18n ================= */
const I18N = {
  ja: {
    ogTitle: "プライバシーポリシー｜{siteName}",
    ogDesc: "{siteName}のプライバシーポリシー（個人情報保護方針）です。",
    h1: "プライバシーポリシー",
    lastUpdated: "最終更新日：{date}",
    loading: "読み込み中です…",
    intro:
      "{siteName}（以下「当店」）は、当店の提供するオンラインストア（以下「本サービス」）において取得するお客様の個人情報を、関係法令に基づき適切に取り扱います。",
    s1: "1. 取得する情報",
    s1_li1: "氏名、住所、電話番号、メールアドレス等の連絡先",
    s1_li2:
      "配送先情報、注文内容、決済に関する情報（カード情報は決済代行会社が管理）",
    s1_li3: "アクセスログ、クッキー等（閲覧履歴・端末情報・IPアドレス等）",
    s2: "2. 利用目的",
    s2_li1: "商品の販売、発送、アフターサービスの提供",
    s2_li2: "ご注文・お問い合わせ対応、本人確認、通知・連絡",
    s2_li3: "不正防止・安全管理、利用規約違反への対応",
    s2_li4: "サービス改善、統計データの作成（個人を識別できない形）",
    s2_li5: "法令に基づく対応",
    s3: "3. 第三者提供",
    s3_p: "法令に基づく場合や、配送事業者・決済代行会社（Stripe）等への委託を除き、本人の同意なく第三者へ提供しません。",
    s4: "4. 決済・外部サービス",
    s4_p: "カード情報は Stripe 社により安全に処理され、当店はカード番号等を保持しません。また、当店は Firebase/Google のサービスを利用しており、アクセス解析やセキュリティ目的でクッキーが利用される場合があります。",
    s5: "5. クッキー（Cookie）",
    s5_p: "本サービスの利便性向上・分析のためにクッキーを使用します。ブラウザ設定により無効化できますが、機能の一部が利用できなくなる場合があります。",
    s6: "6. 安全管理措置",
    s6_p: "不正アクセス防止等のため、アクセス制御・暗号化・監査ログ等、適切な安全管理措置を講じます。",
    s7: "7. 開示・訂正・利用停止",
    s7_p: "ご本人からの開示・訂正・利用停止等のご請求に誠実に対応します。下記「お問い合わせ先」までご連絡ください。",
    s8: "8. 改定",
    s8_p: "内容を改定する場合があり、改定後は本ページに掲載した時点で効力を生じます。",
    s9: "9. お問い合わせ先",
    contactLabel: "{siteName}（{ownerName}）",
    footnote:
      "本ストアは Pageit プラットフォーム上で運営されています（決済代行：Stripe）。",
  },
  en: {
    ogTitle: "Privacy Policy | {siteName}",
    ogDesc: "This is the Privacy Policy for {siteName}.",
    h1: "Privacy Policy",
    lastUpdated: "Last updated: {date}",
    loading: "Loading…",
    intro:
      "{siteName} (the “Store”) appropriately handles personal data obtained through its online store (the “Service”) in accordance with applicable laws and regulations.",
    s1: "1. Information We Collect",
    s1_li1: "Contact details (name, address, phone number, email, etc.)",
    s1_li2:
      "Delivery address, order details, and payment-related information (card data is managed by the payment processor)",
    s1_li3:
      "Access logs and cookies (browsing history, device info, IP address, etc.)",
    s2: "2. Purposes of Use",
    s2_li1: "To sell and ship products and provide after-sales support",
    s2_li2:
      "To handle orders/inquiries, verify identity, and send notices/communications",
    s2_li3: "To prevent fraud, ensure security, and address Terms violations",
    s2_li4:
      "To improve the Service and create statistics (in a de-identified form)",
    s2_li5: "To comply with legal obligations",
    s3: "3. Provision to Third Parties",
    s3_p: "Except where required by law or when entrusting tasks to carriers and payment processors (e.g., Stripe), we do not provide personal data to third parties without consent.",
    s4: "4. Payments & External Services",
    s4_p: "Card data is securely processed by Stripe and is not retained by us. We also use Firebase/Google services; cookies may be used for analytics and security purposes.",
    s5: "5. Cookies",
    s5_p: "We use cookies to enhance usability and for analytics. You may disable cookies in your browser settings, but some features may not function properly.",
    s6: "6. Security Measures",
    s6_p: "We implement appropriate security measures such as access controls, encryption, and audit logging to prevent unauthorized access.",
    s7: "7. Disclosure, Correction & Suspension",
    s7_p: "We will faithfully respond to requests for disclosure, correction, or suspension of use. Please contact us at the address below.",
    s8: "8. Changes",
    s8_p: "We may revise this Policy; revisions take effect when posted on this page.",
    s9: "9. Contact",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "This store runs on the Pageit platform (payment processing by Stripe).",
  },
  zh: {
    ogTitle: "隐私政策｜{siteName}",
    ogDesc: "这是 {siteName} 的隐私政策（个人信息保护方针）。",
    h1: "隐私政策",
    lastUpdated: "最后更新日期：{date}",
    loading: "加载中…",
    intro:
      "{siteName}（下称“本店”）将依据相关法律法规，妥善处理通过本店提供的网上商店（下称“本服务”）所获取的您的个人信息。",
    s1: "1. 收集的信息",
    s1_li1: "姓名、地址、电话号码、电子邮箱等联系方式",
    s1_li2: "收货信息、订单内容、与支付相关的信息（卡信息由支付代办公司管理）",
    s1_li3: "访问日志、Cookie 等（浏览记录、设备信息、IP 地址等）",
    s2: "2. 使用目的",
    s2_li1: "商品销售、发货、售后服务",
    s2_li2: "处理订单/咨询、身份核验、通知与联系",
    s2_li3: "防止不正当行为与安全管理、应对违反使用条款的行为",
    s2_li4: "服务改进、制作统计数据（以无法识别个人的形式）",
    s2_li5: "依法进行的应对",
    s3: "3. 向第三方提供",
    s3_p: "除依法要求，或委托物流承运商、支付代办公司（Stripe）等必要情形外，未经本人同意，不向第三方提供个人信息。",
    s4: "4. 支付与外部服务",
    s4_p: "卡信息由 Stripe 安全处理，我们不保存卡号等信息。此外，我们使用 Firebase/Google 的服务，可能为分析与安全目的使用 Cookie。",
    s5: "5. Cookie（浏览器缓存）",
    s5_p: "为提升便利性与进行分析，我们使用 Cookie。您可在浏览器中禁用，但可能导致部分功能不可用。",
    s6: "6. 安全管理措施",
    s6_p: "为防止未经授权的访问，我们采取访问控制、加密、审计日志等适当的安全管理措施。",
    s7: "7. 公开、更正与停止使用",
    s7_p: "我们将诚实地回应您的公开、更正、停止使用等请求。请联系下述“联系方式”。",
    s8: "8. 变更",
    s8_p: "本政策可能会变更，变更后自本页面发布之时起生效。",
    s9: "9. 联系方式",
    contactLabel: "{siteName}（{ownerName}）",
    footnote: "本店运行于 Pageit 平台（支付处理：Stripe）。",
  },
  "zh-TW": {
    ogTitle: "隱私權政策｜{siteName}",
    ogDesc: "{siteName} 的隱私權政策（個人資訊保護方針）。",
    h1: "隱私權政策",
    lastUpdated: "最後更新日：{date}",
    loading: "讀取中…",
    intro:
      "{siteName}（以下稱「本店」）將依相關法令，妥適處理於本店提供之線上商店（以下稱「本服務」）所取得的您的個人資料。",
    s1: "1. 蒐集之資訊",
    s1_li1: "姓名、地址、電話、電子郵件等聯絡方式",
    s1_li2:
      "收件資訊、訂單內容、與付款相關之資訊（卡片資訊由金流代收代付公司管理）",
    s1_li3: "存取紀錄、Cookie 等（瀏覽紀錄、裝置資訊、IP 位址等）",
    s2: "2. 使用目的",
    s2_li1: "商品販售、出貨、售後服務",
    s2_li2: "處理訂單／詢問、身分驗證、通知與聯繫",
    s2_li3: "防杜不正當行為與安全管理、對應違反使用條款之行為",
    s2_li4: "服務改善、製作統計資料（以不可識別個人之方式）",
    s2_li5: "依法辦理之對應",
    s3: "3. 向第三人提供",
    s3_p: "除依法或委託物流業者、金流公司（Stripe）等必要情形外，未經本人同意，不提供個人資料予第三人。",
    s4: "4. 付款與外部服務",
    s4_p: "卡片資訊由 Stripe 安全處理，本店不保存卡號等資訊。另本店使用 Firebase/Google 服務，可能基於分析與安全目的使用 Cookie。",
    s5: "5. Cookie（瀏覽器端資料）",
    s5_p: "為提升便利性與分析目的，將使用 Cookie。您可於瀏覽器停用，但部分功能可能無法使用。",
    s6: "6. 資安措施",
    s6_p: "為防止未經授權之存取，我們採取存取控制、加密、稽核紀錄等適當之安全管理措施。",
    s7: "7. 查閱、訂正與停止使用",
    s7_p: "對於您提出之查閱、訂正、停止使用等請求，我們將誠實處理。請洽下述「聯絡方式」。",
    s8: "8. 變更",
    s8_p: "本政策可能變更，變更後自公布於本頁面之時起生效。",
    s9: "9. 聯絡方式",
    contactLabel: "{siteName}（{ownerName}）",
    footnote: "本店運行於 Pageit 平台（金流處理：Stripe）。",
  },
  ko: {
    ogTitle: "개인정보처리방침｜{siteName}",
    ogDesc: "{siteName}의 개인정보처리방침입니다.",
    h1: "개인정보처리방침",
    lastUpdated: "최종 업데이트: {date}",
    loading: "로딩 중…",
    intro:
      "{siteName}(이하 ‘당사’)는 온라인 스토어(이하 ‘서비스’)에서 취득하는 고객의 개인정보를 관련 법령에 따라 적절히 처리합니다.",
    s1: "1. 수집하는 정보",
    s1_li1: "이름, 주소, 전화번호, 이메일 등 연락처",
    s1_li2:
      "배송지 정보, 주문 내용, 결제 관련 정보(카드 정보는 결제대행사가 관리)",
    s1_li3: "접속 로그, 쿠키 등(열람 기록, 기기 정보, IP 주소 등)",
    s2: "2. 이용 목적",
    s2_li1: "상품 판매, 배송, A/S 제공",
    s2_li2: "주문/문의 대응, 본인 확인, 통지/연락",
    s2_li3: "부정행위 방지 및 보안 관리, 이용약관 위반 대응",
    s2_li4: "서비스 개선, 통계 작성(개인을 식별할 수 없는 형태)",
    s2_li5: "법령에 따른 대응",
    s3: "3. 제3자 제공",
    s3_p: "법령에 근거하거나 배송업체·결제대행사(Stripe) 등에 위탁하는 경우를 제외하고, 본인의 동의 없이 제3자에게 제공하지 않습니다.",
    s4: "4. 결제 및 외부 서비스",
    s4_p: "카드 정보는 Stripe가 안전하게 처리하며, 당사는 카드 번호 등을 보유하지 않습니다. 또한 Firebase/Google 서비스를 이용하며, 분석 및 보안 목적으로 쿠키가 사용될 수 있습니다.",
    s5: "5. 쿠키(Cookie)",
    s5_p: "편의성 향상 및 분석을 위해 쿠키를 사용합니다. 브라우저 설정으로 비활성화할 수 있으나 일부 기능이 제한될 수 있습니다.",
    s6: "6. 안전관리 조치",
    s6_p: "무단 접근 방지를 위해 접근 제어, 암호화, 감사 로그 등 적절한 보안 조치를 시행합니다.",
    s7: "7. 열람·정정·이용정지",
    s7_p: "열람, 정정, 이용정지 등의 요청에 성실히 대응합니다. 아래 ‘문의처’로 연락해 주십시오.",
    s8: "8. 변경",
    s8_p: "내용은 변경될 수 있으며, 변경 후 본 페이지에 게시한 시점부터 효력이 발생합니다.",
    s9: "9. 문의처",
    contactLabel: "{siteName}({ownerName})",
    footnote: "본 스토어는 Pageit 플랫폼에서 운영됩니다(결제대행: Stripe).",
  },
  fr: {
    ogTitle: "Politique de confidentialité | {siteName}",
    ogDesc: "Politique de confidentialité de {siteName}.",
    h1: "Politique de confidentialité",
    lastUpdated: "Dernière mise à jour : {date}",
    loading: "Chargement…",
    intro:
      "{siteName} (ci-après « le Magasin ») traite correctement les données personnelles obtenues via sa boutique en ligne (ci-après « le Service ») conformément aux lois applicables.",
    s1: "1. Données collectées",
    s1_li1: "Coordonnées (nom, adresse, téléphone, e-mail, etc.)",
    s1_li2:
      "Adresse de livraison, détails de commande, informations de paiement (les données de carte sont gérées par le prestataire de paiement)",
    s1_li3:
      "Journaux d’accès et cookies (historique de navigation, informations sur l’appareil, adresse IP, etc.)",
    s2: "2. Finalités d’utilisation",
    s2_li1: "Vente et expédition de produits, service après-vente",
    s2_li2:
      "Traitement des commandes/demandes, vérification d’identité, notifications/communications",
    s2_li3:
      "Prévention de la fraude, sécurité et traitement des violations des Conditions",
    s2_li4:
      "Amélioration du Service, élaboration de statistiques (sous forme anonymisée)",
    s2_li5: "Respect des obligations légales",
    s3: "3. Communication à des tiers",
    s3_p: "Sauf obligation légale ou sous-traitance à des transporteurs et prestataires de paiement (Stripe), les données ne sont pas communiquées à des tiers sans consentement.",
    s4: "4. Paiements et services externes",
    s4_p: "Les données de carte sont traitées de manière sécurisée par Stripe et ne sont pas conservées par nous. Nous utilisons également les services Firebase/Google ; des cookies peuvent être utilisés à des fins d’analyse et de sécurité.",
    s5: "5. Cookies",
    s5_p: "Nous utilisons des cookies pour améliorer l’ergonomie et à des fins d’analyse. Vous pouvez les désactiver dans votre navigateur, mais certaines fonctionnalités pourraient être limitées.",
    s6: "6. Mesures de sécurité",
    s6_p: "Nous appliquons des mesures appropriées (contrôle d’accès, chiffrement, journaux d’audit) pour prévenir les accès non autorisés.",
    s7: "7. Accès, rectification et suspension",
    s7_p: "Nous répondons de bonne foi aux demandes d’accès, de rectification ou de suspension. Veuillez contacter l’adresse ci-dessous.",
    s8: "8. Modifications",
    s8_p: "La présente politique peut être modifiée ; elle prend effet dès sa publication sur cette page.",
    s9: "9. Contact",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "Cette boutique fonctionne sur la plateforme Pageit (paiement traité par Stripe).",
  },
  es: {
    ogTitle: "Política de privacidad | {siteName}",
    ogDesc: "Política de privacidad de {siteName}.",
    h1: "Política de privacidad",
    lastUpdated: "Última actualización: {date}",
    loading: "Cargando…",
    intro:
      "{siteName} (en adelante, «la Tienda») trata adecuadamente los datos personales obtenidos a través de su tienda en línea (el «Servicio»), conforme a la legislación aplicable.",
    s1: "1. Información que recopilamos",
    s1_li1:
      "Datos de contacto (nombre, dirección, teléfono, correo electrónico, etc.)",
    s1_li2:
      "Dirección de envío, detalles del pedido e información de pago (los datos de tarjeta los gestiona el procesador de pagos)",
    s1_li3:
      "Registros de acceso y cookies (historial de navegación, información del dispositivo, dirección IP, etc.)",
    s2: "2. Finalidades de uso",
    s2_li1: "Venta y envío de productos, servicio posventa",
    s2_li2:
      "Gestión de pedidos/consultas, verificación de identidad, avisos/comunicaciones",
    s2_li3:
      "Prevención de fraudes, seguridad y respuesta a infracciones de las Condiciones",
    s2_li4:
      "Mejora del Servicio y elaboración de estadísticas (de forma no identificable)",
    s2_li5: "Cumplimiento de obligaciones legales",
    s3: "3. Cesión a terceros",
    s3_p: "Salvo por obligación legal o por encargos a transportistas y procesadores de pagos (Stripe), no cedemos datos personales a terceros sin consentimiento.",
    s4: "4. Pagos y servicios externos",
    s4_p: "Los datos de tarjeta son procesados de forma segura por Stripe y no se conservan por nuestra parte. También usamos servicios de Firebase/Google; se pueden usar cookies con fines de análisis y seguridad.",
    s5: "5. Cookies",
    s5_p: "Usamos cookies para mejorar la usabilidad y con fines analíticos. Puede deshabilitarlas en su navegador, pero algunas funciones podrían verse afectadas.",
    s6: "6. Medidas de seguridad",
    s6_p: "Aplicamos medidas adecuadas como control de acceso, cifrado y registros de auditoría para prevenir accesos no autorizados.",
    s7: "7. Acceso, rectificación y suspensión",
    s7_p: "Atenderemos de buena fe las solicitudes de acceso, rectificación o suspensión del uso. Contáctenos en la dirección abajo indicada.",
    s8: "8. Cambios",
    s8_p: "Podemos modificar esta política; las modificaciones entran en vigor al publicarse en esta página.",
    s9: "9. Contacto",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "Esta tienda funciona en la plataforma Pageit (procesamiento de pagos por Stripe).",
  },
  de: {
    ogTitle: "Datenschutzerklärung | {siteName}",
    ogDesc: "Datenschutzerklärung von {siteName}.",
    h1: "Datenschutzerklärung",
    lastUpdated: "Letzte Aktualisierung: {date}",
    loading: "Wird geladen…",
    intro:
      "{siteName} (nachfolgend „der Shop“) verarbeitet personenbezogene Daten, die über den Online-Shop (der „Service“) erhoben werden, gemäß den geltenden Gesetzen.",
    s1: "1. Erhobene Daten",
    s1_li1: "Kontaktdaten (Name, Adresse, Telefon, E-Mail usw.)",
    s1_li2:
      "Lieferadresse, Bestelldaten und Zahlungsinformationen (Kartendaten werden vom Zahlungsdienstleister verwaltet)",
    s1_li3:
      "Zugriffsprotokolle und Cookies (Browserverlauf, Geräteinformationen, IP-Adresse usw.)",
    s2: "2. Verarbeitungszwecke",
    s2_li1: "Verkauf und Versand von Produkten, After-Sales-Service",
    s2_li2:
      "Bearbeitung von Bestellungen/Anfragen, Identitätsprüfung, Benachrichtigungen/Kommunikation",
    s2_li3:
      "Betrugsprävention, Sicherheit und Behandlung von Verstößen gegen die Nutzungsbedingungen",
    s2_li4:
      "Verbesserung des Services und Erstellung von Statistiken (in nicht identifizierbarer Form)",
    s2_li5: "Erfüllung gesetzlicher Pflichten",
    s3: "3. Weitergabe an Dritte",
    s3_p: "Außer wenn gesetzlich erforderlich oder bei Beauftragung von Versandunternehmen und Zahlungsdienstleistern (z. B. Stripe) geben wir ohne Einwilligung keine Daten an Dritte weiter.",
    s4: "4. Zahlungen und externe Dienste",
    s4_p: "Kartendaten werden sicher von Stripe verarbeitet und nicht von uns gespeichert. Wir nutzen zudem Firebase/Google-Dienste; Cookies können zu Analyse- und Sicherheitszwecken eingesetzt werden.",
    s5: "5. Cookies",
    s5_p: "Wir verwenden Cookies zur Verbesserung der Nutzbarkeit und für Analysen. Diese können im Browser deaktiviert werden; dadurch können Funktionen eingeschränkt sein.",
    s6: "6. Sicherheitsmaßnahmen",
    s6_p: "Zum Schutz vor unbefugtem Zugriff setzen wir u. a. Zugriffskontrollen, Verschlüsselung und Audit-Logs ein.",
    s7: "7. Auskunft, Berichtigung, Sperrung",
    s7_p: "Wir reagieren in gutem Glauben auf Anträge auf Auskunft, Berichtigung oder Sperrung. Bitte kontaktieren Sie die untenstehende Adresse.",
    s8: "8. Änderungen",
    s8_p: "Diese Richtlinie kann geändert werden; Änderungen gelten ab Veröffentlichung auf dieser Seite.",
    s9: "9. Kontakt",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "Dieser Shop wird auf der Pageit-Plattform betrieben (Zahlungsabwicklung durch Stripe).",
  },
  pt: {
    ogTitle: "Política de Privacidade | {siteName}",
    ogDesc: "Política de privacidade de {siteName}.",
    h1: "Política de Privacidade",
    lastUpdated: "Última atualização: {date}",
    loading: "Carregando…",
    intro:
      "{siteName} (doravante, “a Loja”) trata adequadamente os dados pessoais obtidos por meio de sua loja online (o “Serviço”), em conformidade com a legislação aplicável.",
    s1: "1. Informações coletadas",
    s1_li1: "Dados de contato (nome, endereço, telefone, e-mail etc.)",
    s1_li2:
      "Endereço de entrega, detalhes do pedido e informações de pagamento (os dados do cartão são geridos pelo processador de pagamentos)",
    s1_li3:
      "Registros de acesso e cookies (histórico de navegação, informações do dispositivo, endereço IP etc.)",
    s2: "2. Finalidades de uso",
    s2_li1: "Venda e envio de produtos, atendimento pós-venda",
    s2_li2:
      "Atender pedidos/solicitações, verificação de identidade, notificações/comunicações",
    s2_li3: "Prevenção de fraudes e segurança, resposta a violações dos Termos",
    s2_li4:
      "Aprimoramento do Serviço e elaboração de estatísticas (de forma não identificável)",
    s2_li5: "Cumprimento de obrigações legais",
    s3: "3. Fornecimento a terceiros",
    s3_p: "Salvo quando exigido por lei ou quando houver terceirização a transportadoras e processadores de pagamentos (como Stripe), não fornecemos dados a terceiros sem consentimento.",
    s4: "4. Pagamentos e serviços externos",
    s4_p: "Os dados de cartão são processados com segurança pela Stripe e não são retidos por nós. Também usamos serviços do Firebase/Google; cookies podem ser usados para análise e segurança.",
    s5: "5. Cookies",
    s5_p: "Usamos cookies para melhorar a usabilidade e para fins analíticos. É possível desativá-los no navegador, mas algumas funcionalidades podem ser afetadas.",
    s6: "6. Medidas de segurança",
    s6_p: "Implementamos medidas apropriadas, como controle de acesso, criptografia e logs de auditoria, para prevenir acessos não autorizados.",
    s7: "7. Acesso, correção e suspensão",
    s7_p: "Responderemos de boa-fé a solicitações de acesso, correção ou suspensão de uso. Entre em contato pelo endereço abaixo.",
    s8: "8. Alterações",
    s8_p: "Esta Política pode ser alterada; as alterações passam a vigorar quando publicadas nesta página.",
    s9: "9. Contato",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "Esta loja opera na plataforma Pageit (processamento de pagamentos pela Stripe).",
  },
  it: {
    ogTitle: "Informativa sulla privacy | {siteName}",
    ogDesc: "Informativa sulla privacy di {siteName}.",
    h1: "Informativa sulla privacy",
    lastUpdated: "Ultimo aggiornamento: {date}",
    loading: "Caricamento…",
    intro:
      "{siteName} (di seguito, «il Negozio») tratta correttamente i dati personali acquisiti tramite il proprio negozio online («il Servizio») in conformità alla normativa applicabile.",
    s1: "1. Dati raccolti",
    s1_li1: "Dati di contatto (nome, indirizzo, telefono, e-mail, ecc.)",
    s1_li2:
      "Indirizzo di consegna, dettagli dell’ordine e informazioni di pagamento (i dati della carta sono gestiti dal prestatore di servizi di pagamento)",
    s1_li3:
      "Log di accesso e cookie (cronologia di navigazione, informazioni sul dispositivo, indirizzo IP, ecc.)",
    s2: "2. Finalità del trattamento",
    s2_li1: "Vendita e spedizione dei prodotti, assistenza post-vendita",
    s2_li2:
      "Gestione di ordini/richieste, verifica d’identità, notifiche/comunicazioni",
    s2_li3:
      "Prevenzione delle frodi, sicurezza e gestione delle violazioni dei Termini",
    s2_li4:
      "Miglioramento del Servizio e creazione di statistiche (in forma non identificabile)",
    s2_li5: "Adempimenti di legge",
    s3: "3. Comunicazione a terzi",
    s3_p: "Salvo obblighi di legge o affidamenti a corrieri e prestatori di pagamento (es. Stripe), i dati non sono comunicati a terzi senza consenso.",
    s4: "4. Pagamenti e servizi esterni",
    s4_p: "I dati della carta sono trattati in modo sicuro da Stripe e non vengono conservati da noi. Utilizziamo anche i servizi Firebase/Google; i cookie possono essere usati per analisi e sicurezza.",
    s5: "5. Cookie",
    s5_p: "Utilizziamo i cookie per migliorare l’usabilità e per fini analitici. È possibile disattivarli nel browser, ma alcune funzionalità potrebbero risultare limitate.",
    s6: "6. Misure di sicurezza",
    s6_p: "Adottiamo misure adeguate come controllo degli accessi, cifratura e registri di audit per prevenire accessi non autorizzati.",
    s7: "7. Accesso, rettifica e sospensione",
    s7_p: "Risponderemo in buona fede alle richieste di accesso, rettifica o sospensione dell’uso. Contattateci all’indirizzo sotto indicato.",
    s8: "8. Modifiche",
    s8_p: "La presente informativa può essere modificata; le modifiche hanno effetto al momento della pubblicazione in questa pagina.",
    s9: "9. Contatti",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "Questo negozio è gestito sulla piattaforma Pageit (pagamenti a cura di Stripe).",
  },
  ru: {
    ogTitle: "Политика конфиденциальности | {siteName}",
    ogDesc: "Политика конфиденциальности {siteName}.",
    h1: "Политика конфиденциальности",
    lastUpdated: "Последнее обновление: {date}",
    loading: "Загрузка…",
    intro:
      "{siteName} («Магазин») надлежащим образом обрабатывает персональные данные, полученные через интернет-магазин («Сервис»), в соответствии с применимыми законами.",
    s1: "1. Какие данные мы собираем",
    s1_li1: "Контактные данные (имя, адрес, телефон, e-mail и т. д.)",
    s1_li2:
      "Адрес доставки, сведения о заказе и платежная информация (данные карты обрабатываются платёжным провайдером)",
    s1_li3:
      "Журналы доступа и cookie-файлы (история посещений, сведения об устройстве, IP-адрес и т. д.)",
    s2: "2. Цели обработки",
    s2_li1: "Продажа и отправка товаров, послепродажное обслуживание",
    s2_li2: "Обработка заказов/запросов, проверка личности, уведомления/связь",
    s2_li3:
      "Предотвращение мошенничества, безопасность и реагирование на нарушения Условий",
    s2_li4: "Улучшение Сервиса и подготовка статистики (в обезличенном виде)",
    s2_li5: "Исполнение требований законодательства",
    s3: "3. Передача третьим лицам",
    s3_p: "За исключением случаев, предусмотренных законом, или при передаче задач перевозчикам и платёжным сервисам (например, Stripe), данные не передаются третьим лицам без согласия.",
    s4: "4. Платежи и внешние сервисы",
    s4_p: "Данные банковских карт безопасно обрабатываются Stripe и не хранятся у нас. Мы также используем сервисы Firebase/Google; cookie могут применяться в целях аналитики и безопасности.",
    s5: "5. Cookie-файлы",
    s5_p: "Мы используем cookie для повышения удобства и аналитики. Вы можете отключить cookie в настройках браузера, но это может ограничить функциональность.",
    s6: "6. Меры безопасности",
    s6_p: "Для предотвращения несанкционированного доступа применяются контроль доступа, шифрование и аудит-логи.",
    s7: "7. Доступ, исправление и ограничение обработки",
    s7_p: "Мы добросовестно рассматриваем запросы на доступ, исправление или ограничение обработки. Свяжитесь с нами по адресу ниже.",
    s8: "8. Изменения",
    s8_p: "Политика может изменяться; изменения вступают в силу с момента публикации на данной странице.",
    s9: "9. Контакты",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "Этот магазин работает на платформе Pageit (обработка платежей — Stripe).",
  },
  th: {
    ogTitle: "นโยบายความเป็นส่วนตัว | {siteName}",
    ogDesc: "นโยบายความเป็นส่วนตัวของ {siteName}",
    h1: "นโยบายความเป็นส่วนตัว",
    lastUpdated: "อัปเดตล่าสุด: {date}",
    loading: "กำลังโหลด…",
    intro:
      "{siteName} (“ร้านค้า”) ดำเนินการข้อมูลส่วนบุคคลที่ได้รับผ่านร้านค้าออนไลน์ (“บริการ”) ตามกฎหมายที่เกี่ยวข้องอย่างเหมาะสม",
    s1: "1. ข้อมูลที่เก็บรวบรวม",
    s1_li1: "ข้อมูลติดต่อ (ชื่อ ที่อยู่ โทรศัพท์ อีเมล ฯลฯ)",
    s1_li2:
      "ที่อยู่จัดส่ง รายละเอียดคำสั่งซื้อ และข้อมูลการชำระเงิน (ข้อมูลบัตรได้รับการดูแลโดยผู้ให้บริการรับชำระเงิน)",
    s1_li3:
      "บันทึกการเข้าถึงและคุกกี้ (ประวัติการเข้าชม ข้อมูลอุปกรณ์ ที่อยู่ IP ฯลฯ)",
    s2: "2. วัตถุประสงค์ในการใช้",
    s2_li1: "การขายและจัดส่งสินค้า บริการหลังการขาย",
    s2_li2: "จัดการคำสั่งซื้อ/สอบถาม ยืนยันตัวตน การแจ้งเตือน/การติดต่อ",
    s2_li3: "ป้องกันการทุจริตและดูแลความปลอดภัย จัดการการละเมิดข้อกำหนดการใช้",
    s2_li4: "พัฒนาบริการและจัดทำสถิติ (ในรูปแบบที่ไม่ระบุตัวบุคคล)",
    s2_li5: "ปฏิบัติตามกฎหมาย",
    s3: "3. การเปิดเผยต่อบุคคลที่สาม",
    s3_p: "ยกเว้นตามที่กฎหมายกำหนด หรือเมื่อต้องมอบหมายให้ผู้ให้บริการขนส่งและผู้ให้บริการชำระเงิน (เช่น Stripe) เราจะไม่เปิดเผยข้อมูลแก่บุคคลที่สามโดยปราศจากความยินยอม",
    s4: "4. การชำระเงินและบริการภายนอก",
    s4_p: "ข้อมูลบัตรได้รับการประมวลผลอย่างปลอดภัยโดย Stripe และเราไม่ได้เก็บข้อมูลบัตรไว้ นอกจากนี้ เราใช้บริการ Firebase/Google และอาจใช้คุกกี้เพื่อการวิเคราะห์และความปลอดภัย",
    s5: "5. คุกกี้ (Cookies)",
    s5_p: "เราใช้คุกกี้เพื่อเพิ่มความสะดวกและเพื่อการวิเคราะห์ คุณสามารถปิดการใช้งานในเบราว์เซอร์ได้ แต่บางฟังก์ชันอาจใช้งานไม่ได้",
    s6: "6. มาตรการรักษาความปลอดภัย",
    s6_p: "เราใช้มาตรการที่เหมาะสม เช่น การควบคุมการเข้าถึง การเข้ารหัส และบันทึกการตรวจสอบ เพื่อป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต",
    s7: "7. การเข้าถึง แก้ไข และระงับการใช้",
    s7_p: "เราจะตอบสนองต่อคำขอเข้าถึง แก้ไข หรือระงับการใช้ข้อมูลอย่างสุจริต โปรดติดต่อที่อยู่ด้านล่าง",
    s8: "8. การเปลี่ยนแปลง",
    s8_p: "นโยบายนี้อาจมีการเปลี่ยนแปลง และมีผลเมื่อเผยแพร่บนหน้านี้",
    s9: "9. ติดต่อ",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "ร้านค้านี้ทำงานบนแพลตฟอร์ม Pageit (ประมวลผลการชำระเงินโดย Stripe)",
  },
  vi: {
    ogTitle: "Chính sách quyền riêng tư | {siteName}",
    ogDesc: "Chính sách quyền riêng tư của {siteName}.",
    h1: "Chính sách quyền riêng tư",
    lastUpdated: "Cập nhật lần cuối: {date}",
    loading: "Đang tải…",
    intro:
      "{siteName} (gọi là “Cửa hàng”) xử lý phù hợp dữ liệu cá nhân thu thập được qua cửa hàng trực tuyến (“Dịch vụ”) theo quy định pháp luật hiện hành.",
    s1: "1. Thông tin thu thập",
    s1_li1: "Thông tin liên hệ (họ tên, địa chỉ, điện thoại, email, v.v.)",
    s1_li2:
      "Địa chỉ giao hàng, chi tiết đơn hàng, thông tin thanh toán (dữ liệu thẻ do đơn vị xử lý thanh toán quản lý)",
    s1_li3:
      "Nhật ký truy cập và cookie (lịch sử duyệt web, thông tin thiết bị, địa chỉ IP, v.v.)",
    s2: "2. Mục đích sử dụng",
    s2_li1: "Bán và giao hàng, dịch vụ sau bán",
    s2_li2: "Xử lý đơn hàng/yêu cầu, xác minh danh tính, thông báo/liên hệ",
    s2_li3: "Ngăn ngừa gian lận, bảo mật và xử lý vi phạm Điều khoản",
    s2_li4: "Cải thiện Dịch vụ, lập thống kê (dưới dạng không thể định danh)",
    s2_li5: "Tuân thủ nghĩa vụ pháp lý",
    s3: "3. Cung cấp cho bên thứ ba",
    s3_p: "Trừ khi pháp luật yêu cầu hoặc khi ủy thác cho đơn vị vận chuyển và xử lý thanh toán (ví dụ Stripe), chúng tôi không cung cấp dữ liệu cho bên thứ ba nếu không có sự đồng ý.",
    s4: "4. Thanh toán và dịch vụ bên ngoài",
    s4_p: "Dữ liệu thẻ được Stripe xử lý an toàn và chúng tôi không lưu trữ. Chúng tôi cũng sử dụng dịch vụ của Firebase/Google; cookie có thể được dùng cho phân tích và bảo mật.",
    s5: "5. Cookie",
    s5_p: "Chúng tôi sử dụng cookie để tăng tính tiện dụng và cho mục đích phân tích. Bạn có thể tắt cookie trong trình duyệt; một số chức năng có thể bị hạn chế.",
    s6: "6. Biện pháp bảo mật",
    s6_p: "Chúng tôi áp dụng các biện pháp phù hợp như kiểm soát truy cập, mã hóa và nhật ký kiểm toán để ngăn truy cập trái phép.",
    s7: "7. Truy cập, chỉnh sửa và tạm ngừng",
    s7_p: "Chúng tôi sẽ phản hồi thiện chí các yêu cầu truy cập, chỉnh sửa hoặc tạm ngừng sử dụng. Vui lòng liên hệ theo địa chỉ dưới đây.",
    s8: "8. Thay đổi",
    s8_p: "Chính sách có thể thay đổi; hiệu lực từ khi được đăng trên trang này.",
    s9: "9. Liên hệ",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "Cửa hàng này vận hành trên nền tảng Pageit (xử lý thanh toán bởi Stripe).",
  },
  id: {
    ogTitle: "Kebijakan Privasi | {siteName}",
    ogDesc: "Kebijakan privasi {siteName}.",
    h1: "Kebijakan Privasi",
    lastUpdated: "Pembaruan terakhir: {date}",
    loading: "Memuat…",
    intro:
      "{siteName} (“Toko”) menangani data pribadi yang diperoleh melalui toko online (“Layanan”) sesuai dengan peraturan yang berlaku.",
    s1: "1. Informasi yang Dikumpulkan",
    s1_li1: "Detail kontak (nama, alamat, telepon, email, dll.)",
    s1_li2:
      "Alamat pengiriman, rincian pesanan, dan informasi pembayaran (data kartu dikelola oleh pemroses pembayaran)",
    s1_li3:
      "Log akses dan cookie (riwayat penelusuran, info perangkat, alamat IP, dll.)",
    s2: "2. Tujuan Penggunaan",
    s2_li1: "Penjualan dan pengiriman produk, layanan purna jual",
    s2_li2:
      "Menangani pesanan/pertanyaan, verifikasi identitas, pemberitahuan/komunikasi",
    s2_li3:
      "Pencegahan kecurangan, keamanan, dan penanganan pelanggaran Ketentuan",
    s2_li4:
      "Peningkatan Layanan dan pembuatan statistik (dalam bentuk tidak dapat diidentifikasi)",
    s2_li5: "Kepatuhan terhadap kewajiban hukum",
    s3: "3. Pemberian kepada Pihak Ketiga",
    s3_p: "Kecuali diwajibkan oleh hukum atau saat menunjuk pihak pengiriman dan pemroses pembayaran (mis. Stripe), kami tidak memberikan data kepada pihak ketiga tanpa persetujuan.",
    s4: "4. Pembayaran & Layanan Eksternal",
    s4_p: "Data kartu diproses dengan aman oleh Stripe dan tidak kami simpan. Kami juga menggunakan layanan Firebase/Google; cookie dapat digunakan untuk analitik dan keamanan.",
    s5: "5. Cookie",
    s5_p: "Kami menggunakan cookie untuk meningkatkan kegunaan dan untuk analitik. Anda dapat menonaktifkannya di browser, namun beberapa fitur mungkin terbatas.",
    s6: "6. Langkah Keamanan",
    s6_p: "Kami menerapkan langkah yang sesuai seperti kontrol akses, enkripsi, dan log audit untuk mencegah akses tidak sah.",
    s7: "7. Akses, Perbaikan & Penangguhan",
    s7_p: "Kami akan menanggapi dengan itikad baik permintaan akses, perbaikan, atau penangguhan penggunaan. Silakan hubungi alamat di bawah.",
    s8: "8. Perubahan",
    s8_p: "Kebijakan dapat berubah; perubahan berlaku sejak dipublikasikan pada halaman ini.",
    s9: "9. Kontak",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "Toko ini berjalan di platform Pageit (pemrosesan pembayaran oleh Stripe).",
  },
  hi: {
    ogTitle: "गोपनीयता नीति | {siteName}",
    ogDesc: "{siteName} की गोपनीयता नीति।",
    h1: "गोपनीयता नीति",
    lastUpdated: "अंतिम अद्यतन: {date}",
    loading: "लोड हो रहा है…",
    intro:
      '{siteName} ("स्टोर") अपनी ऑनलाइन स्टोर ("सेवा") के माध्यम से प्राप्त व्यक्तिगत डेटा का, प्रासंगिक कानूनों के अनुसार, उपयुक्त रूप से प्रबंधन करता है।',
    s1: "1. हम कौन-सी जानकारी एकत्र करते हैं",
    s1_li1: "संपर्क विवरण (नाम, पता, फोन, ईमेल आदि)",
    s1_li2:
      "डिलीवरी पता, ऑर्डर विवरण और भुगतान संबंधी जानकारी (कार्ड डेटा भुगतान प्रोसेसर द्वारा प्रबंधित)",
    s1_li3:
      "ऐक्सेस लॉग और कुकीज़ (ब्राउज़िंग इतिहास, डिवाइस जानकारी, IP पता आदि)",
    s2: "2. उपयोग के उद्देश्य",
    s2_li1: "उत्पादों की बिक्री/शिपिंग और बाद-बिक्री सेवा",
    s2_li2: "ऑर्डर/प्रश्नों का प्रबंधन, पहचान सत्यापन, सूचनाएँ/संचार",
    s2_li3: "कपट-रोधी व सुरक्षा, तथा नियमों के उल्लंघन पर कार्यवाही",
    s2_li4: "सेवा में सुधार और आँकड़ों का निर्माण (अगोपनीय रूप में)",
    s2_li5: "कानूनी दायित्वों का पालन",
    s3: "3. तृतीय पक्षों को प्रदान करना",
    s3_p: "कानून द्वारा आवश्यक स्थितियों या शिपिंग/भुगतान प्रोसेसर (जैसे Stripe) को कार्य सौंपने के अलावा, बिना सहमति के हम डेटा तृतीय पक्षों को उपलब्ध नहीं कराते।",
    s4: "4. भुगतान और बाहरी सेवाएँ",
    s4_p: "कार्ड डेटा Stripe द्वारा सुरक्षित रूप से संसाधित किया जाता है और हम इसे संग्रहीत नहीं करते। हम Firebase/Google सेवाओं का भी उपयोग करते हैं; विश्लेषण और सुरक्षा हेतु कुकीज़ का उपयोग हो सकता है।",
    s5: "5. कुकीज़",
    s5_p: "सुविधा और विश्लेषण हेतु हम कुकीज़ का उपयोग करते हैं। आप ब्राउज़र में उन्हें अक्षम कर सकते हैं, पर कुछ सुविधाएँ सीमित हो सकती हैं।",
    s6: "6. सुरक्षा उपाय",
    s6_p: "अनधिकृत पहुँच रोकने हेतु हम उपयुक्त सुरक्षा उपाय (ऐक्सेस कंट्रोल, एन्क्रिप्शन, ऑडिट लॉग) अपनाते हैं।",
    s7: "7. अभिगम, संशोधन और उपयोग-स्थगन",
    s7_p: "हम अभिगम, संशोधन या उपयोग-स्थगन के अनुरोधों पर सद्भावना से प्रतिक्रिया देंगे। कृपया नीचे दिए गए पते पर संपर्क करें।",
    s8: "8. परिवर्तन",
    s8_p: "यह नीति समय-समय पर बदली जा सकती है; परिवर्तन इस पृष्ठ पर प्रकाशित होते ही प्रभावी होंगे।",
    s9: "9. संपर्क",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "यह स्टोर Pageit प्लेटफ़ॉर्म पर संचालित है (भुगतान प्रसंस्करण: Stripe)।",
  },
  ar: {
    ogTitle: "سياسة الخصوصية | {siteName}",
    ogDesc: "سياسة الخصوصية الخاصة بـ {siteName}.",
    h1: "سياسة الخصوصية",
    lastUpdated: "آخر تحديث: {date}",
    loading: "جارٍ التحميل…",
    intro:
      "تتعامل {siteName} («المتجر») مع البيانات الشخصية التي يتم الحصول عليها عبر المتجر الإلكتروني («الخدمة») وفقًا للقوانين والأنظمة المعمول بها.",
    s1: "1. المعلومات التي نجمعها",
    s1_li1:
      "بيانات الاتصال (الاسم، العنوان، رقم الهاتف، البريد الإلكتروني، إلخ)",
    s1_li2:
      "عنوان التسليم، تفاصيل الطلب، ومعلومات الدفع (تُدار بيانات البطاقات من قبل معالج الدفع)",
    s1_li3:
      "سجلات الوصول وملفات تعريف الارتباط (سجل التصفح، معلومات الجهاز، عنوان IP، إلخ)",
    s2: "2. أغراض الاستخدام",
    s2_li1: "بيع وشحن المنتجات وخدمة ما بعد البيع",
    s2_li2: "معالجة الطلبات/الاستفسارات، التحقق من الهوية، الإشعارات/الاتصالات",
    s2_li3: "منع الاحتيال وضمان الأمان والتعامل مع مخالفات الشروط",
    s2_li4: "تحسين الخدمة وإعداد الإحصاءات (بصورة غير مُعرِّفة للهوية)",
    s2_li5: "الامتثال للالتزامات القانونية",
    s3: "3. الإفصاح لأطراف ثالثة",
    s3_p: "باستثناء ما يقتضيه القانون أو عند إسناد المهام لشركات الشحن ومعالجي الدفع (مثل Stripe)، لا نقدّم البيانات لأطراف ثالثة دون موافقة.",
    s4: "4. المدفوعات والخدمات الخارجية",
    s4_p: "تُعالَج بيانات البطاقات بصورة آمنة بواسطة Stripe ولا نحتفظ بها. نستخدم أيضًا خدمات Firebase/Google؛ وقد تُستخدم ملفات تعريف الارتباط لأغراض التحليلات والأمان.",
    s5: "5. ملفات تعريف الارتباط (الكوकीز)",
    s5_p: "نستخدم الكوكيز لتحسين قابلية الاستخدام ولأغراض التحليل. يمكنك تعطيلها من إعدادات المتصفح، وقد يؤثر ذلك في بعض الميزات.",
    s6: "6. تدابير الأمان",
    s6_p: "نطبّق تدابير مناسبة مثل التحكم في الوصول والتشفير وسجلات التدقيق لمنع الوصول غير المصرح به.",
    s7: "7. الوصول والتصحيح وإيقاف الاستخدام",
    s7_p: "سنستجيب بحسن نية لطلبات الوصول أو التصحيح أو إيقاف الاستخدام. يُرجى التواصل عبر العنوان أدناه.",
    s8: "8. التغييرات",
    s8_p: "قد نقوم بتعديل هذه السياسة؛ ويسري أي تعديل عند نشره في هذه الصفحة.",
    s9: "9. معلومات الاتصال",
    contactLabel: "{siteName} ({ownerName})",
    footnote:
      "يعمل هذا المتجر على منصة Pageit (معالجة المدفوعات بواسطة Stripe).",
  },
} as const satisfies Record<LangKey, Record<string, string>>;

// 翻訳キー型（jaを基準に）
type MsgKey = keyof (typeof I18N)["ja"];

// すべての言語で同一キーを持つ前提のユニオン抜け用
const I18N_UNI: Record<LangKey, Record<MsgKey, string>> = I18N as any;

// 右から左の言語
const RTL = new Set<LangKey>(["ar"]);

// 小文字化した正規キーへのマップ
const CANON_MAP: Record<string, LangKey> = Object.fromEntries(
  LANGS.map((l) => [l.key.toLowerCase(), l.key as LangKey])
) as Record<string, LangKey>;

// エイリアス（方言・別表記）
const ALIAS: Record<string, LangKey> = {
  // Chinese
  zh: "zh",
  "zh-cn": "zh",
  "zh-hans": "zh",
  "zh-sg": "zh",
  "zh-tw": "zh-TW",
  "zh-hant": "zh-TW",
  "zh-hk": "zh-TW",
  "zh-mo": "zh-TW",
};

function pickLang(raw?: string | null): LangKey {
  const orig = (raw || "").trim();
  if (!orig) return "ja";
  const low = orig.toLowerCase();

  if (CANON_MAP[low]) return CANON_MAP[low];
  if (ALIAS[low]) return ALIAS[low];

  // プレフィックス一致（例: en-GB → en）
  const prefix = low.split("-")[0];
  if (CANON_MAP[prefix]) return CANON_MAP[prefix];

  return "ja";
}

function t(lang: LangKey, key: MsgKey, params?: Record<string, string>) {
  const base = I18N_UNI[lang][key] ?? I18N_UNI.ja[key];
  if (!params) return base;
  return base.replace(/\{(\w+)\}/g, (_: string, k: string) => params[k] ?? "");
}

/* ================ Page ================ */
export default function PrivacyPage() {
  const [s, setS] = useState<OwnerSettings>({});
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
  const canonical = APP_URL
    ? `${APP_URL.replace(/\/$/, "")}/privacy`
    : "/privacy";

  // UI言語（未定義時はja）
  let lang: LangKey = "ja";
  try {
    const u = useUILang?.();
    lang = pickLang(
      (u && (u.uiLang || (Array.isArray(u) ? (u as any)[0] : ""))) as string
    );
  } catch {
    lang = "ja";
  }

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "siteSettings", SITE_KEY));
      const d = (snap.data() as any) || {};
      setS({
        siteName: d?.siteName ?? "",
        ownerName: d?.ownerName ?? "",
        ownerEmail: d?.ownerEmail ?? "",
        ownerAddress: d?.ownerAddress ?? "",
        ownerPhone: d?.ownerPhone ?? "",
      });
    })();
  }, []);

  const ymd = useMemo(() => {
    const d = new Date(); // ← ここでだけ生成
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return lang === "ja" ? `${y}年${m}月${day}日` : `${y}-${m}-${day}`;
  }, [lang]); // ← today依存を削除

  const siteName =
    s.siteName || (lang === "en" ? "Online Store" : "オンラインストア");
  const ogTitle = t(lang, "ogTitle", { siteName });
  const ogDesc = t(lang, "ogDesc", { siteName });

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

      <main
        className="min-h-screen bg-white/50"
        dir={RTL.has(lang) ? "rtl" : "ltr"}
      >
        <section className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold mb-6">{t(lang, "h1")}</h1>
          <p className="text-sm text-gray-500 mb-8">
            {t(lang, "lastUpdated", { date: ymd })}
          </p>

          <div className="space-y-6 text-[15px] leading-relaxed">
            <p>{t(lang, "intro", { siteName })}</p>

            <section>
              <h2 className="text-xl font-semibold mb-2">{t(lang, "s1")}</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>{t(lang, "s1_li1")}</li>
                <li>{t(lang, "s1_li2")}</li>
                <li>{t(lang, "s1_li3")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">{t(lang, "s2")}</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>{t(lang, "s2_li1")}</li>
                <li>{t(lang, "s2_li2")}</li>
                <li>{t(lang, "s2_li3")}</li>
                <li>{t(lang, "s2_li4")}</li>
                <li>{t(lang, "s2_li5")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">{t(lang, "s3")}</h2>
              <p>{t(lang, "s3_p")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">{t(lang, "s4")}</h2>
              <p>{t(lang, "s4_p")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">{t(lang, "s5")}</h2>
              <p>{t(lang, "s5_p")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">{t(lang, "s6")}</h2>
              <p>{t(lang, "s6_p")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">{t(lang, "s7")}</h2>
              <p>{t(lang, "s7_p")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">{t(lang, "s8")}</h2>
              <p>{t(lang, "s8_p")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">{t(lang, "s9")}</h2>
              <p className="whitespace-pre-wrap">
                {t(lang, "contactLabel", {
                  siteName:
                    s.siteName || (lang === "en" ? "Online Store" : "当店"),
                  ownerName:
                    s.ownerName || (lang === "en" ? "Contact" : "担当"),
                })}
                {"\n"}
                {(s.ownerEmail || "—") + " / " + (s.ownerPhone || "—")}
              </p>
            </section>

            <p className="text-xs text-gray-500">{t(lang, "footnote")}</p>
          </div>
        </section>
      </main>
    </>
  );
}
