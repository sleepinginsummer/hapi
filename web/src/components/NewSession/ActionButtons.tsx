import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import { useTranslation } from '@/lib/use-translation'

export function ActionButtons(props: {
    isPending: boolean
    canCreate: boolean
    isDisabled: boolean
    createLabel?: string
    onCancel: () => void
    onCreate: () => void
}) {
    const { t } = useTranslation()

    return (
        <div className="flex shrink-0 gap-2 border-t border-[var(--app-divider)] bg-[var(--app-bg)] px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <Button
                variant="secondary"
                onClick={props.onCancel}
                disabled={props.isDisabled}
            >
                {t('button.cancel')}
            </Button>
            <Button
                onClick={props.onCreate}
                disabled={!props.canCreate}
                aria-busy={props.isPending}
                className="gap-2"
            >
                {props.isPending ? (
                    <>
                        <Spinner size="sm" label={null} className="text-[var(--app-button-text)]" />
                        {t('newSession.creating')}
                    </>
                ) : (
                    (props.createLabel ?? t('newSession.create'))
                )}
            </Button>
        </div>
    )
}
