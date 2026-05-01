
import { motion } from "motion/react";
import { FileText, ShieldCheck, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ReactNode } from "react";
import { useLanguage } from "../context/LanguageContext";

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

function LegalLayout({ title, children }: LegalPageProps) {
  const { t } = useLanguage();

  return (
    <div className="pt-32 pb-24 px-6 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link 
          to="/"
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 font-bold uppercase tracking-widest text-[10px]"
        >
          <ChevronLeft className="w-4 h-4" /> {t('backToHome')}
        </Link>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-[2.5rem] p-10 md:p-16"
      >
        <div className="flex items-center gap-4 mb-10 pb-6 border-b border-white/5">
          <div className="p-4 bg-discord/10 rounded-2xl text-discord">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter">{title}</h1>
        </div>
        
        <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-zinc-400 font-medium leading-relaxed">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export function TermsView() {
  const { language, t } = useLanguage();

  if (language === 'vi') {
    return (
      <LegalLayout title={t('terms')}>
        <section>
          <h2 className="text-white text-xl font-bold mb-4">1. Chấp thuận điều khoản</h2>
          <p>Bằng cách sử dụng Ziji Bot, bạn đồng ý tuân thủ các điều khoản này và Quy định dịch vụ của Discord. Nếu bạn không đồng ý, vui lòng ngừng sử dụng dịch vụ ngay lập tức.</p>
        </section>
        
        <section>
          <h2 className="text-white text-xl font-bold mb-4">2. Quyền hạn sử dụng</h2>
          <p>Ziji Bot cung cấp các tính năng giải trí, âm nhạc và quản trị máy chủ. Bạn không được sử dụng bot cho các mục đích vi phạm pháp luật hoặc quấy rối người dùng khác.</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">3. Giới hạn trách nhiệm</h2>
          <p>Chúng tôi không chịu trách nhiệm về bất kỳ thiệt hại nào phát sinh từ việc sử dụng hoặc không thể sử dụng bot. Dịch vụ được cung cấp "như hiện tại".</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">4. Thay đổi điều khoản</h2>
          <p>Ziji Project có quyền cập nhật các điều khoản này bất cứ lúc nào. Việc tiếp tục sử dụng bot sau khi thay đổi có nghĩa là bạn chấp nhận các điều khoản mới.</p>
        </section>
      </LegalLayout>
    );
  }

  if (language === 'ja') {
    return (
      <LegalLayout title={t('terms')}>
        <section>
          <h2 className="text-white text-xl font-bold mb-4">1. 利用規約への同意</h2>
          <p>Zijiボットを使用することで、これらの規約およびDiscordのサービス規約を遵守することに同意したことになります。同意しない場合は、直ちにサービスの使用を中止してください。</p>
        </section>
        
        <section>
          <h2 className="text-white text-xl font-bold mb-4">2. 使用権</h2>
          <p>Zijiボットはエンターテインメント、音楽、およびサーバー管理機能を提供します。法律に違反する目的や、他のユーザーを嫌がらせする目的でボットを使用することはできません。</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">3. 免責事項</h2>
          <p>ボットの使用または使用不能から生じるいかなる損害についても、当社は責任を負いません。サービスは「現状のまま」提供されます。</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">4. 規約の変更</h2>
          <p>Zijiプロジェクトは、いつでもこれらの規約を更新する権利を有します。変更後もボットを継続して使用することは、新しい規約に同意したことを意味します。</p>
        </section>
      </LegalLayout>
    );
  }

  return (
    <LegalLayout title={t('terms')}>
      <section>
        <h2 className="text-white text-xl font-bold mb-4">1. Acceptance of Terms</h2>
        <p>By using Ziji Bot, you agree to comply with these terms and Discord's Terms of Service. If you do not agree, please stop using the service immediately.</p>
      </section>
      
      <section>
        <h2 className="text-white text-xl font-bold mb-4">2. Usage Rights</h2>
        <p>Ziji Bot provides entertainment, music, and server administration features. You must not use the bot for illegal purposes or to harass other users.</p>
      </section>

      <section>
        <h2 className="text-white text-xl font-bold mb-4">3. Limitation of Liability</h2>
        <p>We are not responsible for any damages arising from the use or inability to use the bot. The service is provided "as is".</p>
      </section>

      <section>
        <h2 className="text-white text-xl font-bold mb-4">4. Changes to Terms</h2>
        <p>Ziji Project reserves the right to update these terms at any time. Continued use of the bot after changes implies acceptance of the new terms.</p>
      </section>
    </LegalLayout>
  );
}

export function PrivacyView() {
  const { language, t } = useLanguage();

  if (language === 'vi') {
    return (
      <LegalLayout title={t('privacy')}>
        <div className="flex items-center gap-2 p-4 bg-blue-500/10 rounded-2xl text-blue-400 text-sm mb-8 border border-blue-500/20">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <p className="font-bold uppercase tracking-wide">Quyền riêng tư của bạn là ưu tiên hàng đầu của chúng tôi.</p>
        </div>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">1. Thông tin chúng tôi thu thập</h2>
          <p>Chúng tôi thu thập các thông tin tối thiểu cần thiết để vận hành bot, bao gồm: ID người dùng, ID máy chủ, và các cài đặt cấu hình trong máy chủ của bạn.</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">2. Cách chúng tôi sử dụng dữ liệu</h2>
          <p>Dữ liệu được sử dụng để cá nhân hóa trải nghiệm (như cấp độ RPG, số dư kinh tế) và thực hiện các lệnh quản trị do bạn yêu cầu.</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">3. Chia sẻ dữ liệu</h2>
          <p>Ziji cam kết không bao giờ bán hoặc chia sẻ dữ liệu người dùng cho bên thứ ba vì mục đích thương mại.</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">4. Quyền của bạn</h2>
          <p>Bạn có quyền yêu cầu xóa toàn bộ dữ liệu liên quan đến tài khoản của mình bằng cách liên hệ với đội ngũ hỗ trợ qua máy chủ Discord chính thức.</p>
        </section>
      </LegalLayout>
    );
  }

  if (language === 'ja') {
    return (
      <LegalLayout title={t('privacy')}>
        <div className="flex items-center gap-2 p-4 bg-blue-500/10 rounded-2xl text-blue-400 text-sm mb-8 border border-blue-500/20">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <p className="font-bold uppercase tracking-wide">あなたのプライバシーは私たちの最優先事項です。</p>
        </div>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">1. 収集する情報</h2>
          <p>ボットの運用のために最低限必要な情報（ユーザーID、サーバーID、サーバー内での設定構成など）を収集します。</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">2. データの使用方法</h2>
          <p>データは、エクスペリエンスのパーソナライズ（RPGレベル、経済残高など）や、リクエストされた管理コマンドの実行に使用されます。</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">3. データの共有</h2>
          <p>Zijiは、商業目的でユーザーデータを第三者に販売または共有しないことを約束します。</p>
        </section>

        <section>
          <h2 className="text-white text-xl font-bold mb-4">4. あなたの権利</h2>
          <p>公式のDiscordサーバーを通じてサポートチームに連絡することで、アカウントに関連するすべてのデータの削除をリクエストする権利があります。</p>
        </section>
      </LegalLayout>
    );
  }

  return (
    <LegalLayout title={t('privacy')}>
      <div className="flex items-center gap-2 p-4 bg-blue-500/10 rounded-2xl text-blue-400 text-sm mb-8 border border-blue-500/20">
        <ShieldCheck className="w-5 h-5 flex-shrink-0" />
        <p className="font-bold uppercase tracking-wide">Your privacy is our top priority.</p>
      </div>

      <section>
        <h2 className="text-white text-xl font-bold mb-4">1. Information We Collect</h2>
        <p>We collect the minimum information necessary to operate the bot, including: User ID, Server ID, and configuration settings within your server.</p>
      </section>

      <section>
        <h2 className="text-white text-xl font-bold mb-4">2. How We Use Data</h2>
        <p>Data is used to personalize the experience (such as RPG levels, economic balance) and execute administrative commands requested by you.</p>
      </section>

      <section>
        <h2 className="text-white text-xl font-bold mb-4">3. Data Sharing</h2>
        <p>Ziji commits to never selling or sharing user data with third parties for commercial purposes.</p>
      </section>

      <section>
        <h2 className="text-white text-xl font-bold mb-4">4. Your Rights</h2>
        <p>You have the right to request the deletion of all data related to your account by contacting the support team via the official Discord server.</p>
      </section>
    </LegalLayout>
  );
}
