import { useCallback, useState } from "react";

type ConfirmRequest = {
  message: string;
  resolve: (confirmed: boolean) => void;
};

function ConfirmDialog({
  message,
  onConfirm,
  onCancel
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="confirm-overlay" role="presentation" onClick={onCancel}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-message" onClick={(event) => event.stopPropagation()}>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const askConfirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ message, resolve });
    });
  }, []);

  const confirmDialog = request ? (
    <ConfirmDialog
      message={request.message}
      onConfirm={() => {
        request.resolve(true);
        setRequest(null);
      }}
      onCancel={() => {
        request.resolve(false);
        setRequest(null);
      }}
    />
  ) : null;

  return { askConfirm, confirmDialog };
}
