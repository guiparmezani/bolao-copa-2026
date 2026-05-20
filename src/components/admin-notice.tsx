type AdminNoticeProps = {
  aviso?: string;
  erro?: string;
  mensagem?: string;
};

export function AdminNotice({ aviso, erro, mensagem }: AdminNoticeProps) {
  return (
    <>
      {erro ? <p className="form-error admin-page-message">{erro}</p> : null}
      {aviso ? <p className="form-warning admin-page-message">{aviso}</p> : null}
      {mensagem ? <p className="prediction-message admin-page-message">{mensagem}</p> : null}
    </>
  );
}
