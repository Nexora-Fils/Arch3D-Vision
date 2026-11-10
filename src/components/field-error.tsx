interface FieldErrorProps {
  message?: string;
  /** Lets the input point at the message with aria-describedby. */
  id?: string;
}

/** Validation message under a form field; renders nothing without a message. */
export const FieldError = ({ message, id }: FieldErrorProps) =>
  message ? (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
